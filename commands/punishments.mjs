import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ComponentType,
  EmbedBuilder,
} from "discord.js";
import fetch from "node-fetch";
import { resolveDiscordUserId } from "./lib/resolveDiscordMember.mjs";
import { hasPermission } from "./lib/permissions.mjs";
import { formatDiscordTimestamp } from "./lib/discordFormatting.mjs";
import {
  getUserPermissions,
  UserGetter,
} from "../controllers/userController.js";

const PUNISHMENTS_PERMISSION_NODE = "zander.web.punishments";
const MAX_PUNISHMENTS_TO_DISPLAY = 50;
const PUNISHMENTS_PER_PAGE = 5;
const PAGINATION_TIMEOUT_MS = 2 * 60 * 1000;
const PAGINATION_CUSTOM_IDS = {
  previous: "punishments:previous",
  next: "punishments:next",
};

function sanitizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value);
  const collapsed = stringValue.replace(/\s+/g, " ").trim();
  return collapsed || null;
}

function truncateText(value, maxLength = 256) {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function formatActor(username, userId) {
  const cleanedUsername = sanitizeText(username);
  if (cleanedUsername) {
    return cleanedUsername;
  }

  if (userId) {
    return `User ID ${userId}`;
  }

  return null;
}

function parseFlag(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();

  if (!normalized || normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return true;
}

function hasTimestamp(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime());
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function formatPunishmentStatus(punishment) {
  const type = String(punishment.type ?? "").toLowerCase();

  if (type === "kick") {
    return "Completed";
  }

  if (type === "warning") {
    return "Logged";
  }

  if (hasTimestamp(punishment.dateRemoved)) {
    return "Removed";
  }

  const active = Number(punishment.active);
  if (Number.isFinite(active) && active === 1) {
    return "Active";
  }

  if (Number.isFinite(active) && active === 0) {
    return "Inactive";
  }

  return null;
}

function shouldIncludeExpiry(punishment) {
  const type = String(punishment.type ?? "").toLowerCase();

  if (!hasTimestamp(punishment.dateEnd)) {
    return false;
  }

  return type !== "kick" && type !== "warning";
}

function toTitleCase(value) {
  if (!value) {
    return "Unknown";
  }

  const lowercase = String(value).toLowerCase();
  return lowercase.charAt(0).toUpperCase() + lowercase.slice(1);
}

function formatPunishmentDetails(punishment) {
  const lines = [];

  lines.push(
    `**Issued:** ${formatDiscordTimestamp(punishment.dateStart, {
      fallback: "Unknown",
    })}`
  );

  const reason = truncateText(sanitizeText(punishment.reason), 512);
  if (reason) {
    lines.push(`**Reason:** ${reason}`);
  }

  const server = sanitizeText(punishment.server);
  if (server) {
    lines.push(`**Server:** ${server}`);
  }

  const status = formatPunishmentStatus(punishment);
  if (status) {
    lines.push(`**Status:** ${status}`);
  }

  if (shouldIncludeExpiry(punishment)) {
    lines.push(
      `**Expires:** ${formatDiscordTimestamp(punishment.dateEnd, {
        fallback: "No expiry",
      })}`
    );
  }

  if (hasTimestamp(punishment.dateRemoved)) {
    lines.push(
      `**Removed:** ${formatDiscordTimestamp(punishment.dateRemoved, {
        fallback: "Unknown",
      })}`
    );
  }

  const removalReason = truncateText(sanitizeText(punishment.reasonRemoved), 512);
  if (removalReason) {
    lines.push(`**Removal Reason:** ${removalReason}`);
  }

  const actor = formatActor(
    punishment.bannedByUsername,
    punishment.bannedByUserId
  );
  if (actor) {
    lines.push(`**Issued By:** ${actor}`);
  }

  if (hasTimestamp(punishment.dateRemoved)) {
    const removedBy = formatActor(
      punishment.removedByUsername,
      punishment.removedByUserId
    );

    if (removedBy) {
      lines.push(`**Removed By:** ${removedBy}`);
    }
  }

  if (parseFlag(punishment.silent)) {
    lines.push("**Silent:** Yes");
  }

  if (!lines.length) {
    return "No additional details available.";
  }

  const value = lines.join("\n");
  if (value.length > 1024) {
    return `${value.slice(0, 1021)}...`;
  }

  return value;
}

function buildPunishmentsEmbed({
  profileDisplayName,
  profileData,
  punishments,
  totalPunishments,
  truncated,
  page,
}) {
  const totalPages = Math.max(
    1,
    Math.ceil(punishments.length / PUNISHMENTS_PER_PAGE)
  );

  const embed = new EmbedBuilder()
    .setTitle(`Punishments for ${profileDisplayName}`)
    .setColor(Colors.DarkRed)
    .setTimestamp(new Date())
    .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

  const descriptionParts = [];

  if (profileData?.discordId) {
    descriptionParts.push(`Linked Discord: <@${profileData.discordId}>`);
  }

  let totalLine = `Total punishments: ${totalPunishments}`;
  if (truncated) {
    totalLine += ` (showing first ${punishments.length})`;
  }
  totalLine += ".";
  descriptionParts.push(totalLine);

  const start = page * PUNISHMENTS_PER_PAGE;
  const pagePunishments = punishments.slice(
    start,
    start + PUNISHMENTS_PER_PAGE
  );
  const end = Math.min(start + pagePunishments.length, punishments.length);

  if (totalPages > 1) {
    descriptionParts.push(
      `Viewing punishments ${start + 1}-${end} of ${punishments.length}.`
    );
  }

  if (descriptionParts.length) {
    embed.setDescription(descriptionParts.join("\n"));
  }

  const fields = pagePunishments
    .map((punishment, index) => ({
      name: `${start + index + 1}. ${toTitleCase(punishment.type)}`,
      value: formatPunishmentDetails(punishment),
    }))
    .filter((field) => field.value);

  if (fields.length) {
    embed.addFields(fields);
  }

  return embed;
}

function buildPaginationComponents(page, totalPages) {
  if (totalPages <= 1) {
    return [];
  }

  const previousButton = new ButtonBuilder()
    .setCustomId(PAGINATION_CUSTOM_IDS.previous)
    .setLabel("Previous")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("◀️")
    .setDisabled(page === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId(PAGINATION_CUSTOM_IDS.next)
    .setLabel("Next")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("▶️")
    .setDisabled(page >= totalPages - 1);

  return [new ActionRowBuilder().addComponents(previousButton, nextButton)];
}

function getProfileDisplayName(profileData = {}) {
  if (!profileData || typeof profileData !== "object") {
    return "the specified user";
  }

  if (profileData.username) {
    return profileData.username;
  }

  if (profileData.uuid) {
    return profileData.uuid;
  }

  if (profileData.discordId) {
    return `Discord user ${profileData.discordId}`;
  }

  return "the specified user";
}

export class PunishmentsCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("punishments")
        .setDescription("Look up punishment history for a linked user.")
        .addStringOption((option) =>
          option
            .setName("username")
            .setDescription("Minecraft username of the user to check.")
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName("discord_user")
            .setDescription("Discord user whose linked account should be checked.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("discord_tag")
            .setDescription("Discord tag, ID, or @username of the user to check.")
            .setRequired(false)
        )
    );
  }

  async chatInputRun(interaction) {
    const username = interaction.options.getString("username");
    const discordUser = interaction.options.getUser("discord_user");
    const discordTag = interaction.options.getString("discord_tag");

    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("Failed to defer punishments command reply", error);
      return;
    }

    const userGetter = new UserGetter();
    const linkedAccount = await userGetter.byDiscordId(interaction.user.id);

    if (!linkedAccount) {
      const notLinkedEmbed = new EmbedBuilder()
        .setTitle("No Linked Account")
        .setDescription(
          "We couldn't find a linked site account for you. Please link your account before using punishment commands."
        )
        .setColor(Colors.Red);

      return interaction.editReply({
        embeds: [notLinkedEmbed],
      });
    }

    const userPermissions = await getUserPermissions(linkedAccount);
    if (!hasPermission(userPermissions, PUNISHMENTS_PERMISSION_NODE)) {
      const noPermissionEmbed = new EmbedBuilder()
        .setTitle("No Permission")
        .setDescription("You do not have access to use this command.")
        .setColor(Colors.Red);

      return interaction.editReply({
        embeds: [noPermissionEmbed],
      });
    }

    if (!username && !discordUser && !discordTag) {
      return interaction.editReply({
        content:
          "Please provide a Minecraft username or Discord user/tag to review.",
      });
    }

    const profileUrl = new URL(
      `${process.env.siteAddress}/api/user/profile/get`
    );

    if (username) {
      profileUrl.searchParams.set("username", username);
    } else {
      const resolvedDiscordId = await resolveDiscordUserId(interaction, {
        discordUser,
        discordTag,
      });

      if (!resolvedDiscordId) {
        return interaction.editReply({
          content:
            "Unable to resolve the provided Discord information to a linked account.",
        });
      }

      profileUrl.searchParams.set("discordId", resolvedDiscordId);
    }

    let profileResponseJson;
    try {
      const profileResponse = await fetch(profileUrl, {
        headers: { "x-access-token": process.env.apiKey },
      });

      profileResponseJson = await profileResponse.json();
    } catch (error) {
      console.error("Failed to fetch profile data for punishments", error);
      return interaction.editReply({
        content:
          "We were unable to fetch profile information at this time. Please try again shortly.",
      });
    }

    if (!profileResponseJson?.success || !profileResponseJson.data?.profileData) {
      return interaction.editReply({
        content: "No linked user was found for the provided information.",
      });
    }

    const profileData = profileResponseJson.data.profileData;
    const profileDisplayName = getProfileDisplayName(profileData);

    const punishmentsUrl = new URL(
      `${process.env.siteAddress}/api/user/punishments`
    );

    if (profileData.uuid) {
      punishmentsUrl.searchParams.set("uuid", profileData.uuid);
    } else if (profileData.username) {
      punishmentsUrl.searchParams.set("username", profileData.username);
    } else if (profileData.discordId) {
      punishmentsUrl.searchParams.set("discordId", profileData.discordId);
    } else {
      return interaction.editReply({
        content:
          "Unable to determine the user's identity for punishment lookup.",
      });
    }

    let punishmentsResponseJson;
    try {
      const punishmentsResponse = await fetch(punishmentsUrl, {
        headers: { "x-access-token": process.env.apiKey },
      });

      punishmentsResponseJson = await punishmentsResponse.json();
    } catch (error) {
      console.error("Failed to fetch punishments", error);
      return interaction.editReply({
        content:
          "We were unable to retrieve punishments at this time. Please try again shortly.",
      });
    }

    if (!punishmentsResponseJson?.success || !Array.isArray(punishmentsResponseJson.data)) {
      return interaction.editReply({
        content:
          "The punishment service returned an unexpected response. Please try again later.",
      });
    }

    const punishments = punishmentsResponseJson.data;

    if (!punishments.length) {
      return interaction.editReply({
        content: `${profileDisplayName} has no recorded punishments.`,
      });
    }

    const limitedPunishments = punishments.slice(0, MAX_PUNISHMENTS_TO_DISPLAY);
    const truncated = limitedPunishments.length < punishments.length;
    const totalPages = Math.max(
      1,
      Math.ceil(limitedPunishments.length / PUNISHMENTS_PER_PAGE)
    );

    let currentPage = 0;

    const initialEmbed = buildPunishmentsEmbed({
      profileDisplayName,
      profileData,
      punishments: limitedPunishments,
      totalPunishments: punishments.length,
      truncated,
      page: currentPage,
    });

    const initialComponents = buildPaginationComponents(
      currentPage,
      totalPages
    );

    await interaction.editReply({
      embeds: [initialEmbed],
      components: initialComponents,
    });

    if (totalPages <= 1) {
      return;
    }

    let replyMessage;
    try {
      replyMessage = await interaction.fetchReply();
    } catch (error) {
      console.error("Failed to fetch punishments reply message", error);
      return;
    }

    if (
      !replyMessage ||
      typeof replyMessage.createMessageComponentCollector !== "function"
    ) {
      return;
    }

    const collector = replyMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: PAGINATION_TIMEOUT_MS,
      filter: (componentInteraction) => {
        if (componentInteraction.user.id !== interaction.user.id) {
          return false;
        }

        if (
          componentInteraction.customId !== PAGINATION_CUSTOM_IDS.previous &&
          componentInteraction.customId !== PAGINATION_CUSTOM_IDS.next
        ) {
          return false;
        }

        return (
          componentInteraction.message?.interaction?.id === interaction.id
        );
      },
    });

    collector.on("collect", async (componentInteraction) => {
      try {
        if (
          componentInteraction.customId === PAGINATION_CUSTOM_IDS.previous &&
          currentPage > 0
        ) {
          currentPage -= 1;
        } else if (
          componentInteraction.customId === PAGINATION_CUSTOM_IDS.next &&
          currentPage < totalPages - 1
        ) {
          currentPage += 1;
        } else {
          await componentInteraction.deferUpdate();
          return;
        }

        const updatedEmbed = buildPunishmentsEmbed({
          profileDisplayName,
          profileData,
          punishments: limitedPunishments,
          totalPunishments: punishments.length,
          truncated,
          page: currentPage,
        });

        const updatedComponents = buildPaginationComponents(
          currentPage,
          totalPages
        );

        await componentInteraction.update({
          embeds: [updatedEmbed],
          components: updatedComponents,
        });
      } catch (error) {
        console.error("Failed to update punishment pagination", error);
        try {
          await componentInteraction.deferUpdate();
        } catch (deferError) {
          console.error("Failed to defer pagination interaction", deferError);
        }
      }
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply({
          components: [],
        });
      } catch (error) {
        console.error("Failed to clear punishment pagination components", error);
      }
    });
  }
}
