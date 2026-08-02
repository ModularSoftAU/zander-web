import { Command } from "@sapphire/framework";
import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { createRequire } from "module";
import { isValidUsername } from "../lib/discord/mojangApi.mjs";
import { createNameHistoryLookupService } from "../lib/discord/nameHistoryLookup.mjs";
import {
  buildNameHistoryEmbedData,
  NOT_FOUND_MESSAGE,
  UNAVAILABLE_MESSAGE,
  createCooldownTracker,
} from "../lib/discord/nameHistoryFormat.mjs";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

const NH_CONFIG = config?.discord?.namehistory ?? {};
const ALLOWED_CHANNEL_IDS = NH_CONFIG.allowedChannelIds ?? [];
const COOLDOWN_SECONDS = NH_CONFIG.cooldownSeconds ?? 10;
const CACHE_DURATION_MINUTES = NH_CONFIG.cacheDurationMinutes ?? 60;
const REQUEST_TIMEOUT_SECONDS = NH_CONFIG.requestTimeoutSeconds ?? 10;
const PUBLIC_RESULTS = NH_CONFIG.publicResults ?? true;

const sharedLookupService = createNameHistoryLookupService({
  requestTimeoutMs: REQUEST_TIMEOUT_SECONDS * 1000,
  cacheTtlMs: CACHE_DURATION_MINUTES * 60 * 1000,
  minIntervalMs: 500,
});
const sharedCooldownTracker = createCooldownTracker(COOLDOWN_SECONDS);

function addNameHistoryOption(builder) {
  return builder.addStringOption((opt) =>
    opt.setName("username").setDescription("Minecraft username").setRequired(true)
  );
}

export async function handleNameHistoryLookup(
  interaction,
  { lookupService, cooldownTracker, isAdmin, featureEnabled = features?.discord?.namehistory }
) {
  if (!featureEnabled) {
    return interaction.reply({ content: "This command is currently disabled.", ephemeral: true });
  }

  const username = interaction.options.getString("username");

  if (ALLOWED_CHANNEL_IDS.length > 0 && !ALLOWED_CHANNEL_IDS.includes(interaction.channelId)) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({ content: "This command isn't available in this channel." });
  }

  if (!isValidUsername(username)) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({ content: "That is not a valid Minecraft username." });
  }

  if (cooldownTracker.isOnCooldown(interaction.user.id, isAdmin)) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({ content: `You're on cooldown — please wait before running this command again.` });
  }

  await interaction.deferReply({ ephemeral: !PUBLIC_RESULTS });
  cooldownTracker.recordUse(interaction.user.id);

  try {
    const result = await lookupService.lookupNameHistory(username);

    if (result.status === "not_found") {
      return await interaction.editReply({ content: NOT_FOUND_MESSAGE(username) });
    }
    if (result.status === "unavailable") {
      return await interaction.editReply({ content: UNAVAILABLE_MESSAGE });
    }
    if (result.status === "invalid") {
      return await interaction.editReply({ content: "That is not a valid Minecraft username." });
    }

    const data = buildNameHistoryEmbedData(result);
    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .addFields(data.fields)
      .setFooter({ text: data.footer });
    if (data.thumbnailUrl) embed.setThumbnail(data.thumbnailUrl);

    return await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[namehistory] Lookup failed:", err?.message ?? err);
    return interaction.editReply({
      content: "Something went wrong looking that up. Please try again later.",
    });
  }
}

function isInteractionAdmin(interaction) {
  return Boolean(interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator));
}

export class NameHistoryCommand extends Command {
  constructor(context, options) {
    super(context, { ...options, name: "namehistory" });
  }

  registerApplicationCommands(registry) {
    if (!features?.discord?.namehistory) return;
    const builder = addNameHistoryOption(
      new SlashCommandBuilder().setName("namehistory").setDescription("Look up a Minecraft player's NameMC username history.")
    );
    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    return handleNameHistoryLookup(interaction, {
      lookupService: sharedLookupService,
      cooldownTracker: sharedCooldownTracker,
      isAdmin: isInteractionAdmin(interaction),
    });
  }
}

export class NhCommand extends Command {
  constructor(context, options) {
    super(context, { ...options, name: "nh" });
  }

  registerApplicationCommands(registry) {
    if (!features?.discord?.namehistory) return;
    const builder = addNameHistoryOption(
      new SlashCommandBuilder().setName("nh").setDescription("Alias for /namehistory.")
    );
    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    return handleNameHistoryLookup(interaction, {
      lookupService: sharedLookupService,
      cooldownTracker: sharedCooldownTracker,
      isAdmin: isInteractionAdmin(interaction),
    });
  }
}
