import { Command } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import { resolveDiscordUserId } from "./lib/resolveDiscordMember.mjs";
import { hasPermission } from "./lib/permissions.mjs";
import { formatDiscordTimestamp } from "./lib/discordFormatting.mjs";
import {
  getUserPermissions,
  UserGetter,
} from "../controllers/userController.js";

const PUNISHMENTS_PERMISSION_NODE = "zander.web.punishments";
const MAX_PUNISHMENTS_TO_DISPLAY = 10;

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
  if (username) {
    return username;
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
    `Issued: ${formatDiscordTimestamp(punishment.dateStart, {
      fallback: "Unknown",
    })}`
  );

  const reason = truncateText(sanitizeText(punishment.reason));
  if (reason) {
    lines.push(`Reason: ${reason}`);
  }

  const status = formatPunishmentStatus(punishment);
  if (status) {
    lines.push(`Status: ${status}`);
  }

  if (shouldIncludeExpiry(punishment)) {
    lines.push(
      `Expires: ${formatDiscordTimestamp(punishment.dateEnd, {
        fallback: "No expiry",
      })}`
    );
  }

  if (hasTimestamp(punishment.dateRemoved)) {
    lines.push(`Removed: ${formatDiscordTimestamp(punishment.dateRemoved)}`);
  }

  const removalReason = truncateText(sanitizeText(punishment.reasonRemoved));
  if (removalReason) {
    lines.push(`Removal reason: ${removalReason}`);
  }

  const actor = formatActor(
    punishment.bannedByUsername,
    punishment.bannedByUserId
  );
  if (actor) {
    lines.push(`By: ${actor}`);
  }

  if (hasTimestamp(punishment.dateRemoved)) {
    const removedBy = formatActor(
      punishment.removedByUsername,
      punishment.removedByUserId
    );

    if (removedBy) {
      lines.push(`Removed by: ${removedBy}`);
    }
  }

  if (parseFlag(punishment.silent)) {
    lines.push("Silent: Yes");
  }

  let value = lines.join("\n");
  if (value.length > 1024) {
    value = `${value.slice(0, 1021)}...`;
  }

  return value || "No additional details available.";
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
    const userGetter = new UserGetter();
    const linkedAccount = await userGetter.byDiscordId(interaction.user.id);

    if (!linkedAccount) {
      const notLinkedEmbed = new EmbedBuilder()
        .setTitle("No Linked Account")
        .setDescription(
          "We couldn't find a linked site account for you. Please link your account before using punishment commands."
        )
        .setColor(Colors.Red);

      return interaction.reply({
        embeds: [notLinkedEmbed],
        ephemeral: true,
      });
    }

    const userPermissions = await getUserPermissions(linkedAccount);
    if (!hasPermission(userPermissions, PUNISHMENTS_PERMISSION_NODE)) {
      const noPermissionEmbed = new EmbedBuilder()
        .setTitle("No Permission")
        .setDescription("You do not have access to use this command.")
        .setColor(Colors.Red);

      return interaction.reply({
        embeds: [noPermissionEmbed],
        ephemeral: true,
      });
    }

    const username = interaction.options.getString("username");
    const discordUser = interaction.options.getUser("discord_user");
    const discordTag = interaction.options.getString("discord_tag");

    if (!username && !discordUser && !discordTag) {
      return interaction.reply({
        content:
          "Please provide a Minecraft username or Discord user/tag to review.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

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
        content: `${profileData.username} has no recorded punishments.`,
      });
    }

    const descriptionParts = [];
    if (profileData.discordId) {
      descriptionParts.push(`Linked Discord: <@${profileData.discordId}>`);
    }

    if (punishments.length > MAX_PUNISHMENTS_TO_DISPLAY) {
      descriptionParts.push(
        `Total punishments: ${punishments.length} (showing latest ${MAX_PUNISHMENTS_TO_DISPLAY}).`
      );
    } else {
      descriptionParts.push(`Total punishments: ${punishments.length}.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Punishment history for ${profileData.username}`)
      .setColor(Colors.DarkRed)
      .setTimestamp(new Date());

    if (descriptionParts.length) {
      embed.setDescription(descriptionParts.join("\n"));
    }

    const fields = punishments
      .slice(0, MAX_PUNISHMENTS_TO_DISPLAY)
      .map((punishment, index) => ({
        name: `${index + 1}. ${toTitleCase(punishment.type)}`,
        value: formatPunishmentDetails(punishment),
      }))
      .filter((field) => field.value);

    if (!fields.length) {
      return interaction.editReply({
        content: `No readable punishments were found for ${profileData.username}.`,
      });
    }

    embed.addFields(fields);

    return interaction.editReply({
      embeds: [embed],
    });
  }
}
