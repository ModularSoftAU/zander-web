import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { createRequire } from "module";
import { hasPermission } from "../lib/discord/permissions.mjs";
import { getUserPermissions, UserGetter } from "../controllers/userController.js";
import { normalizeIp } from "../lib/discord/ipNormalize.mjs";
import {
  getAccountsByIp,
  getIpHistoryByUuid,
  getCurrentStatus,
} from "../controllers/ipHistoryController.js";
import {
  paginate,
  buildUsernamePageEmbedData,
  buildIpPageEmbedData,
} from "../lib/discord/ipCheckFormat.mjs";
import { recordAuditLog, sendAuditEmbed } from "../controllers/ipCheckAuditController.js";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

const PERMISSION_NODE = config?.discord?.ipcheck?.permissionNode ?? "zander.discord.ipcheck";
const AUDIT_CHANNEL_ID = config?.discord?.ipcheck?.auditChannelId ?? "";
const PAGE_SIZE = config?.discord?.ipcheck?.pageSize ?? 8;
const DENIAL_MESSAGE = "You do not have permission to use this command.";

export async function resolveOtherAccountsForIp(ipAddress, excludeUuid) {
  const accounts = await getAccountsByIp(ipAddress);
  return accounts.filter((a) => a.uuid !== excludeUuid).map((a) => a.username);
}

// Fetches the raw per-uuid IP history and current status only — the
// expensive "who else shares this IP" fan-out is deliberately NOT done
// here. It's resolved per-page (see enrichUsernameRecords) once pagination
// has narrowed the record set down to what's actually displayed, so a
// player with hundreds of recorded IPs doesn't trigger hundreds of
// concurrent queries against the shared db pool up front.
export async function assembleUsernameResult({ uuid, username }) {
  const [history, status] = await Promise.all([
    getIpHistoryByUuid(uuid),
    getCurrentStatus(uuid),
  ]);

  return { username, uuid, status, records: history };
}

// Enriches only the records for a single page with the per-IP
// "other accounts" fan-out query.
export async function enrichUsernameRecords(records, excludeUuid) {
  return Promise.all(
    records.map(async (record) => ({
      ...record,
      otherAccounts: await resolveOtherAccountsForIp(record.ip_address, excludeUuid),
    }))
  );
}

// Fetches the raw list of accounts sharing an IP only — the per-account
// current-status fan-out is resolved per-page (see enrichIpRecords) for
// the same resource-exhaustion reason as assembleUsernameResult above.
export async function assembleIpResult(ipAddress) {
  return getAccountsByIp(ipAddress);
}

// Enriches only the records for a single page with the per-account
// current-status query.
export async function enrichIpRecords(records) {
  return Promise.all(
    records.map(async (account) => ({
      ...account,
      status: await getCurrentStatus(account.uuid),
    }))
  );
}

function toEmbed(pageData) {
  return new EmbedBuilder()
    .setTitle(pageData.title)
    .setDescription(pageData.description ?? null)
    .addFields(pageData.fields)
    .setColor(Colors.Blurple)
    .setFooter({ text: pageData.footer });
}

// enrichPage(pageRecords) => Promise<enrichedRecords> — resolves the
// expensive per-record fan-out queries for just the records on ONE page,
// called lazily as pages are viewed and cached so revisiting a page
// doesn't re-query.
async function replyWithPages(interaction, pages, buildEmbedData, enrichPage, ...extraArgs) {
  let pageIndex = 0;
  const total = pages.length;
  const enrichedCache = new Map();

  const getEnrichedPage = async (idx) => {
    if (!enrichedCache.has(idx)) {
      enrichedCache.set(idx, await enrichPage(pages[idx]));
    }
    return enrichedCache.get(idx);
  };

  const buildMessage = async () => {
    const enrichedRecords = await getEnrichedPage(pageIndex);
    const embed = toEmbed(buildEmbedData(enrichedRecords, pageIndex, total, ...extraArgs));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("prev").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === 0),
      new ButtonBuilder().setCustomId("next").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === total - 1)
    );
    return { embeds: [embed], components: total > 1 ? [row] : [] };
  };

  const message = await interaction.editReply(await buildMessage());
  if (total <= 1) return;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "prev") pageIndex = Math.max(0, pageIndex - 1);
    if (i.customId === "next") pageIndex = Math.min(total - 1, pageIndex + 1);
    await i.update(await buildMessage());
  });

  collector.on("end", async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch {
      // message may already be gone; nothing to do
    }
  });
}

export class IpCheckCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    const builder = new SlashCommandBuilder()
      .setName("ipcheck")
      .setDescription("Staff-only IP investigation tool.")
      .addSubcommand((sub) =>
        sub
          .setName("username")
          .setDescription("Look up IP history for a Minecraft username.")
          .addStringOption((opt) => opt.setName("username").setDescription("Minecraft username").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("ip")
          .setDescription("Look up accounts associated with an IP address.")
          .addStringOption((opt) => opt.setName("address").setDescription("IPv4 or IPv6 address").setRequired(true))
      );

    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    if (!features?.discord?.ipcheck) {
      return interaction.reply({ content: "This command is currently disabled.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const linkedAccount = await new UserGetter().byDiscordId(interaction.user.id);
    const userPermissions = linkedAccount ? await getUserPermissions(linkedAccount) : [];
    const allowed = hasPermission(userPermissions, PERMISSION_NODE);

    const subcommand = interaction.options.getSubcommand();
    const queryType = subcommand === "username" ? "USERNAME" : "IP";
    const rawTarget =
      subcommand === "username"
        ? interaction.options.getString("username")
        : interaction.options.getString("address");

    if (!allowed) {
      await this.audit(interaction, queryType, rawTarget, 0, false);
      return interaction.editReply({ content: DENIAL_MESSAGE });
    }

    try {
      if (subcommand === "username") {
        const target = await new UserGetter().byUsername(rawTarget);
        if (!target) {
          await this.audit(interaction, queryType, rawTarget, 0, false);
          return interaction.editReply({ content: `No records found for \`${rawTarget}\`.` });
        }

        const result = await assembleUsernameResult({ uuid: target.uuid, username: target.username });
        await this.audit(interaction, queryType, rawTarget, result.records.length, true);

        const pages = paginate(result.records, PAGE_SIZE);
        return replyWithPages(
          interaction,
          pages,
          buildUsernamePageEmbedData,
          (page) => enrichUsernameRecords(page, result.uuid),
          { username: result.username, uuid: result.uuid, status: result.status }
        );
      }

      const normalizedIp = normalizeIp(rawTarget);
      const records = await assembleIpResult(normalizedIp);
      await this.audit(interaction, queryType, normalizedIp, records.length, true);

      if (records.length === 0) {
        return interaction.editReply({ content: `No records found for \`${normalizedIp}\`.` });
      }

      const pages = paginate(records, PAGE_SIZE);
      return replyWithPages(interaction, pages, buildIpPageEmbedData, enrichIpRecords, normalizedIp);
    } catch (err) {
      if (err.message === "Invalid IP address") {
        await this.audit(interaction, queryType, rawTarget, 0, false);
        return interaction.editReply({ content: "That does not look like a valid IP address." });
      }
      console.error("[ipcheck] Lookup failed:", err.message);
      await this.audit(interaction, queryType, rawTarget, 0, false);
      return interaction.editReply({ content: "The lookup failed due to a server error." });
    }
  }

  // Audit logging must never be able to break the user-facing reply. Any
  // failure here (DB error, oversized discord_tag column value, webhook
  // failure, etc.) is logged and swallowed rather than propagated, so
  // callers can always proceed straight to interaction.editReply(...).
  async audit(interaction, queryType, searchTarget, resultCount, success) {
    try {
      await recordAuditLog({
        discordUserId: interaction.user.id,
        discordTag: interaction.user.tag,
        permissionNode: PERMISSION_NODE,
        queryType,
        searchTarget,
        resultCount,
        success,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
      });
      await sendAuditEmbed(interaction.client, AUDIT_CHANNEL_ID, {
        discordUserId: interaction.user.id,
        discordTag: interaction.user.tag,
        queryType,
        searchTarget,
        resultCount,
        success,
      });
    } catch (err) {
      console.error("[ipcheck] Failed to record audit log:", err?.message ?? err);
    }
  }
}
