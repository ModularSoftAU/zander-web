import { Command } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import { resolveDiscordUserId } from "./lib/resolveDiscordMember.mjs";
import {
  getUserPermissions,
  UserGetter,
} from "../controllers/userController.js";

const AUDIT_PERMISSION_NODE = "zander.web.audit";

function hasPermission(permissions, node) {
  if (!Array.isArray(permissions) || !node) {
    return false;
  }

  const requested = node.trim();
  if (!requested) {
    return false;
  }

  return permissions.some((permission) => {
    if (!permission) return false;
    if (permission === "*") return true;
    if (permission === requested) return true;
    if (permission.endsWith(".*")) {
      const base = permission.slice(0, -1);
      return requested.startsWith(base);
    }
    return false;
  });
}

function formatTimestamp(value) {
  if (!value) {
    return "No record";
  }

  const timestamp = Math.floor(new Date(value).getTime() / 1000);
  if (!Number.isFinite(timestamp)) {
    return "No record";
  }

  return `<t:${timestamp}:F>\n(<t:${timestamp}:R>)`;
}

export class AuditCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("audit")
        .setDescription("Audit activity for a linked user across all platforms.")
        .addStringOption((option) =>
          option
            .setName("username")
            .setDescription("Minecraft username of the user to audit.")
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName("discord_user")
            .setDescription("Discord user whose linked account should be audited.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("discord_tag")
            .setDescription("Discord tag, ID, or @username of the user to audit.")
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
          "We couldn't find a linked site account for you. Please link your account before using audit commands."
        )
        .setColor(Colors.Red);

      return interaction.reply({
        embeds: [notLinkedEmbed],
        ephemeral: true,
      });
    }

    const userPermissions = await getUserPermissions(linkedAccount);
    if (!hasPermission(userPermissions, AUDIT_PERMISSION_NODE)) {
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
          "Please provide a Minecraft username or Discord user/tag to audit.",
        ephemeral: true,
      });
    }

    const fetchURL = new URL(
      `${process.env.siteAddress}/api/user/profile/get`
    );

    if (username) {
      fetchURL.searchParams.set("username", username);
    } else {
      const resolvedDiscordId = await resolveDiscordUserId(interaction, {
        discordUser,
        discordTag,
      });

      if (!resolvedDiscordId) {
        return interaction.reply({
          content:
            "Unable to resolve the provided Discord information to a linked account.",
          ephemeral: true,
        });
      }

      fetchURL.searchParams.set("discordId", resolvedDiscordId);
    }

    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });

    const apiData = await response.json();

    if (!apiData.success || !apiData.data?.profileData) {
      return interaction.reply({
        content: "No linked user was found for the provided information.",
        ephemeral: true,
      });
    }

    const profileData = apiData.data.profileData;

    const embed = new EmbedBuilder()
      .setTitle(`Audit report for ${profileData.username}`)
      .setColor(Colors.Blurple)
      .setTimestamp(new Date())
      .addFields(
        {
          name: "Discord Message",
          value: formatTimestamp(profileData.audit_lastDiscordMessage),
          inline: false,
        },
        {
          name: "Discord Voice",
          value: formatTimestamp(profileData.audit_lastDiscordVoice),
          inline: false,
        },
        {
          name: "Minecraft Login",
          value: formatTimestamp(profileData.audit_lastMinecraftLogin),
          inline: false,
        },
        {
          name: "Minecraft Message",
          value: formatTimestamp(profileData.audit_lastMinecraftMessage),
          inline: false,
        },
        {
          name: "Minecraft Punishment",
          value: formatTimestamp(profileData.audit_lastMinecraftPunishment),
          inline: false,
        },
        {
          name: "Discord Punishment",
          value: formatTimestamp(profileData.audit_lastDiscordPunishment),
          inline: false,
        },
        {
          name: "Website Login",
          value: formatTimestamp(profileData.audit_lastWebsiteLogin),
          inline: false,
        }
      );

    if (profileData.discordId) {
      embed.setDescription(`Linked Discord: <@${profileData.discordId}>`);
    } else {
      embed.setDescription("No Discord account is linked to this user.");
    }

    return interaction.reply({
      embeds: [embed],
    });
  }
}
