import { Command } from "@sapphire/framework";
import {
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { createRequire } from "module";
import { hasPermission } from "../lib/discord/permissions.mjs";
import { formatDiscordTimestamp } from "../lib/discord/discordFormatting.mjs";
import {
  getUserPermissions,
  UserGetter,
} from "../controllers/userController.js";
import {
  createPunishment,
  getActivePunishments,
  getPunishmentHistory,
  liftPunishment,
  hasActivePunishment,
} from "../controllers/discordPunishmentController.js";

const require = createRequire(import.meta.url);
const config = require("../config.json");

const PUNISHMENT_TYPES = {
  warn: "WARN",
  kick: "DISCORD_KICK",
  tempban: "TEMP_BAN",
  ban: "PERM_BAN",
  tempmute: "TEMP_MUTE",
  mute: "PERM_MUTE",
};

const PERMISSION_NODES = config.discord?.punishments?.permissions || {
  can_warn: "zander.discord.punish.warn",
  can_kick: "zander.discord.punish.kick",
  can_ban: "zander.discord.punish.ban",
  can_mute: "zander.discord.punish.mute",
  can_view_history: "zander.discord.punish.history",
};

const SUBCOMMAND_PERMISSION_MAP = {
  warn: PERMISSION_NODES.can_warn,
  kick: PERMISSION_NODES.can_kick,
  tempban: PERMISSION_NODES.can_ban,
  ban: PERMISSION_NODES.can_ban,
  tempmute: PERMISSION_NODES.can_mute,
  mute: PERMISSION_NODES.can_mute,
  unban: PERMISSION_NODES.can_ban,
  unmute: PERMISSION_NODES.can_mute,
  history: PERMISSION_NODES.can_view_history,
};

const APPEAL_URL = `${process.env.siteAddress}${config.discord?.punishments?.appealBaseUrl || "/appeal"}`;
const LOG_CHANNEL_ID = config.discord?.punishments?.logChannelId;
const MUTED_ROLE_ID = config.discord?.roles?.muted;
const GUILD_ID = config.discord?.guildId;

/**
 * Parse a duration string like "1h", "7d", "30m", "2w" into milliseconds.
 * Returns null if invalid.
 */
function parseDuration(input) {
  if (!input) return null;
  const match = String(input).trim().match(/^(\d+)\s*(m|h|d|w)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Get a snapshot of a Discord user's display info.
 */
function getTargetTag(user) {
  if (!user) return null;
  return user.globalName || user.username || user.tag || `${user.id}`;
}

/**
 * Attempt to DM a user before a punishment action.
 * Returns dm_status string.
 */
async function sendPunishmentDm(user, { type, reason, guildName, expiresAt }) {
  try {
    const embed = new EmbedBuilder()
      .setTitle(`Discord ${formatType(type)}`)
      .setColor(Colors.Red)
      .setTimestamp(new Date());

    const lines = [
      `You have received a **${formatType(type).toLowerCase()}** in **${guildName}**.`,
      `**Reason:** ${reason}`,
    ];

    if (expiresAt) {
      const unixTs = Math.floor(expiresAt.getTime() / 1000);
      lines.push(
        `**Expires:** <t:${unixTs}:F> (<t:${unixTs}:R>)`
      );
    }

    lines.push(`\nYou may appeal this punishment at: ${APPEAL_URL}`);

    embed.setDescription(lines.join("\n"));

    await user.send({ embeds: [embed] });
    return "SENT";
  } catch (error) {
    if (error.code === 50007) {
      return "FAILED_CLOSED_DMS";
    }
    console.error("Failed to DM punishment target:", error);
    return "FAILED_UNKNOWN";
  }
}

/**
 * Format punishment type for display.
 */
function formatType(type) {
  const labels = {
    WARN: "Warning",
    DISCORD_KICK: "Kick",
    TEMP_BAN: "Temporary Ban",
    PERM_BAN: "Permanent Ban",
    TEMP_MUTE: "Temporary Mute",
    PERM_MUTE: "Permanent Mute",
  };
  return labels[type] || type;
}

/**
 * Send a log embed to the staff logging channel.
 */
async function sendLogEmbed(client, {
  type,
  targetUser,
  actorUser,
  reason,
  expiresAt,
  punishmentId,
  dmStatus,
  silent,
}) {
  if (!LOG_CHANNEL_ID) return;

  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (!channel?.isTextBased?.()) return;

    const embed = new EmbedBuilder()
      .setTitle(`${formatType(type)}${silent ? " (Silent)" : ""}`)
      .setColor(Colors.DarkRed)
      .setTimestamp(new Date())
      .setFooter({ text: `Punishment ID: ${punishmentId}` });

    const fields = [
      { name: "Target", value: `<@${targetUser.id}> (${getTargetTag(targetUser)})`, inline: true },
      { name: "Staff", value: `<@${actorUser.id}>`, inline: true },
      { name: "Reason", value: reason.length > 1024 ? reason.slice(0, 1021) + "..." : reason },
    ];

    if (expiresAt) {
      const unixTs = Math.floor(expiresAt.getTime() / 1000);
      fields.push({
        name: "Expires",
        value: `<t:${unixTs}:F> (<t:${unixTs}:R>)`,
        inline: true,
      });
    }

    fields.push({ name: "DM Status", value: dmStatus, inline: true });

    embed.addFields(fields);
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Failed to send punishment log embed:", error);
  }
}

/**
 * Check if actor can punish target based on role hierarchy.
 */
function canPunishMember(actorMember, targetMember) {
  if (!actorMember || !targetMember) return true;
  return actorMember.roles.highest.position > targetMember.roles.highest.position;
}

export class PunishCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    const builder = new SlashCommandBuilder()
      .setName("punish")
      .setDescription("Discord punishment commands for staff.")
      .addSubcommand((sub) =>
        sub
          .setName("warn")
          .setDescription("Issue a warning to a user.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to warn.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for the warning.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("evidence").setDescription("Evidence URL (optional).").setRequired(false)
          )
          .addBooleanOption((opt) =>
            opt.setName("silent").setDescription("If true, do not post a log message.").setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("kick")
          .setDescription("Kick a user from the guild.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to kick.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for the kick.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("evidence").setDescription("Evidence URL (optional).").setRequired(false)
          )
          .addBooleanOption((opt) =>
            opt.setName("silent").setDescription("If true, do not post a log message.").setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("tempban")
          .setDescription("Temporarily ban a user.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to temp-ban.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for the ban.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("duration")
              .setDescription("Duration (e.g. 1h, 7d, 2w).")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("evidence").setDescription("Evidence URL (optional).").setRequired(false)
          )
          .addBooleanOption((opt) =>
            opt.setName("silent").setDescription("If true, do not post a log message.").setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("ban")
          .setDescription("Permanently ban a user.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to ban.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for the ban.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("evidence").setDescription("Evidence URL (optional).").setRequired(false)
          )
          .addBooleanOption((opt) =>
            opt.setName("silent").setDescription("If true, do not post a log message.").setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("tempmute")
          .setDescription("Temporarily mute a user (chat + voice).")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to mute.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for the mute.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("duration")
              .setDescription("Duration (e.g. 1h, 7d, 2w).")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("evidence").setDescription("Evidence URL (optional).").setRequired(false)
          )
          .addBooleanOption((opt) =>
            opt.setName("silent").setDescription("If true, do not post a log message.").setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("mute")
          .setDescription("Permanently mute a user (chat + voice).")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to mute.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for the mute.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("evidence").setDescription("Evidence URL (optional).").setRequired(false)
          )
          .addBooleanOption((opt) =>
            opt.setName("silent").setDescription("If true, do not post a log message.").setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("unban")
          .setDescription("Unban a user.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to unban.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for unbanning.").setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("unmute")
          .setDescription("Unmute a user.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to unmute.").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for unmuting.").setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("history")
          .setDescription("View a user's Discord punishment history.")
          .addUserOption((opt) =>
            opt.setName("user").setDescription("The user to look up.").setRequired(true)
          )
      );

    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("Failed to defer punish command reply:", error);
      return;
    }

    // Permission check: actor must have a linked account
    const userGetter = new UserGetter();
    const linkedAccount = await userGetter.byDiscordId(interaction.user.id);

    if (!linkedAccount) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("No Linked Account")
            .setDescription("You must have a linked site account to use punishment commands.")
            .setColor(Colors.Red),
        ],
      });
    }

    const userPermissions = await getUserPermissions(linkedAccount);
    const requiredNode = SUBCOMMAND_PERMISSION_MAP[subcommand];

    if (requiredNode && !hasPermission(userPermissions, requiredNode)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("No Permission")
            .setDescription("You do not have permission to use this command.")
            .setColor(Colors.Red),
        ],
      });
    }

    switch (subcommand) {
      case "warn":
        return this.handleWarn(interaction, linkedAccount);
      case "kick":
        return this.handleKick(interaction, linkedAccount);
      case "tempban":
        return this.handleTempBan(interaction, linkedAccount);
      case "ban":
        return this.handlePermBan(interaction, linkedAccount);
      case "tempmute":
        return this.handleTempMute(interaction, linkedAccount);
      case "mute":
        return this.handlePermMute(interaction, linkedAccount);
      case "unban":
        return this.handleUnban(interaction, linkedAccount);
      case "unmute":
        return this.handleUnmute(interaction, linkedAccount);
      case "history":
        return this.handleHistory(interaction);
      default:
        return interaction.editReply({ content: "Unknown subcommand." });
    }
  }

  async handleWarn(interaction, actorLinked) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const evidence = interaction.options.getString("evidence");
    const silent = interaction.options.getBoolean("silent") ?? false;

    const targetMember = await this.fetchGuildMember(interaction, targetUser.id);
    const actorMember = await this.fetchGuildMember(interaction, interaction.user.id);

    if (targetMember && actorMember && !canPunishMember(actorMember, targetMember)) {
      return interaction.editReply({
        embeds: [this.hierarchyErrorEmbed()],
      });
    }

    const targetLinked = await new UserGetter().byDiscordId(targetUser.id);

    const punishmentId = await createPunishment({
      type: "WARN",
      targetDiscordUserId: targetUser.id,
      targetDiscordTag: getTargetTag(targetUser),
      targetPlayerId: targetLinked?.userId || null,
      actorDiscordUserId: interaction.user.id,
      actorNameSnapshot: getTargetTag(interaction.user),
      reason,
      expiresAt: null,
      context: this.buildContext(interaction, evidence),
      dmStatus: "NOT_APPLICABLE",
    });

    if (!silent) {
      await sendLogEmbed(interaction.client, {
        type: "WARN",
        targetUser,
        actorUser: interaction.user,
        reason,
        expiresAt: null,
        punishmentId,
        dmStatus: "NOT_APPLICABLE",
        silent,
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Warning Issued")
          .setDescription(
            `<@${targetUser.id}> has been warned.\n**Reason:** ${reason}\n**Punishment ID:** ${punishmentId}`
          )
          .setColor(Colors.Yellow)
          .setTimestamp(new Date()),
      ],
    });
  }

  async handleKick(interaction, actorLinked) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const evidence = interaction.options.getString("evidence");
    const silent = interaction.options.getBoolean("silent") ?? false;

    const targetMember = await this.fetchGuildMember(interaction, targetUser.id);
    const actorMember = await this.fetchGuildMember(interaction, interaction.user.id);

    if (targetMember && actorMember && !canPunishMember(actorMember, targetMember)) {
      return interaction.editReply({ embeds: [this.hierarchyErrorEmbed()] });
    }

    if (!targetMember) {
      return interaction.editReply({
        content: "That user is not currently in the guild and cannot be kicked.",
      });
    }

    const targetLinked = await new UserGetter().byDiscordId(targetUser.id);
    const dmStatus = await sendPunishmentDm(targetUser, {
      type: "DISCORD_KICK",
      reason,
      guildName: interaction.guild.name,
      expiresAt: null,
    });

    try {
      await targetMember.kick(`[Punish] ${reason}`);
    } catch (error) {
      console.error("Failed to kick member:", error);
      return interaction.editReply({
        content: "Failed to kick the user. The bot may lack permissions or the user has a higher role.",
      });
    }

    const punishmentId = await createPunishment({
      type: "DISCORD_KICK",
      targetDiscordUserId: targetUser.id,
      targetDiscordTag: getTargetTag(targetUser),
      targetPlayerId: targetLinked?.userId || null,
      actorDiscordUserId: interaction.user.id,
      actorNameSnapshot: getTargetTag(interaction.user),
      reason,
      expiresAt: null,
      context: this.buildContext(interaction, evidence),
      dmStatus,
    });

    if (!silent) {
      await sendLogEmbed(interaction.client, {
        type: "DISCORD_KICK",
        targetUser,
        actorUser: interaction.user,
        reason,
        expiresAt: null,
        punishmentId,
        dmStatus,
        silent,
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("User Kicked")
          .setDescription(
            `<@${targetUser.id}> has been kicked from the guild.\n**Reason:** ${reason}\n**DM Status:** ${dmStatus}\n**Punishment ID:** ${punishmentId}`
          )
          .setColor(Colors.Orange)
          .setTimestamp(new Date()),
      ],
    });
  }

  async handleTempBan(interaction, actorLinked) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const durationStr = interaction.options.getString("duration");
    const evidence = interaction.options.getString("evidence");
    const silent = interaction.options.getBoolean("silent") ?? false;

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.editReply({
        content: "Invalid duration. Use formats like `30m`, `1h`, `7d`, `2w`.",
      });
    }

    const targetMember = await this.fetchGuildMember(interaction, targetUser.id);
    const actorMember = await this.fetchGuildMember(interaction, interaction.user.id);

    if (targetMember && actorMember && !canPunishMember(actorMember, targetMember)) {
      return interaction.editReply({ embeds: [this.hierarchyErrorEmbed()] });
    }

    const expiresAt = new Date(Date.now() + durationMs);
    const targetLinked = await new UserGetter().byDiscordId(targetUser.id);

    const dmStatus = await sendPunishmentDm(targetUser, {
      type: "TEMP_BAN",
      reason,
      guildName: interaction.guild.name,
      expiresAt,
    });

    try {
      await interaction.guild.members.ban(targetUser.id, {
        reason: `[Punish] ${reason}`,
        deleteMessageSeconds: 0,
      });
    } catch (error) {
      console.error("Failed to ban member:", error);
      return interaction.editReply({
        content: "Failed to ban the user. The bot may lack permissions.",
      });
    }

    const punishmentId = await createPunishment({
      type: "TEMP_BAN",
      targetDiscordUserId: targetUser.id,
      targetDiscordTag: getTargetTag(targetUser),
      targetPlayerId: targetLinked?.userId || null,
      actorDiscordUserId: interaction.user.id,
      actorNameSnapshot: getTargetTag(interaction.user),
      reason,
      expiresAt,
      context: this.buildContext(interaction, evidence),
      dmStatus,
    });

    if (!silent) {
      await sendLogEmbed(interaction.client, {
        type: "TEMP_BAN",
        targetUser,
        actorUser: interaction.user,
        reason,
        expiresAt,
        punishmentId,
        dmStatus,
        silent,
      });
    }

    const unixTs = Math.floor(expiresAt.getTime() / 1000);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("User Temporarily Banned")
          .setDescription(
            `<@${targetUser.id}> has been temporarily banned.\n**Reason:** ${reason}\n**Expires:** <t:${unixTs}:F> (<t:${unixTs}:R>)\n**DM Status:** ${dmStatus}\n**Punishment ID:** ${punishmentId}`
          )
          .setColor(Colors.Red)
          .setTimestamp(new Date()),
      ],
    });
  }

  async handlePermBan(interaction, actorLinked) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const evidence = interaction.options.getString("evidence");
    const silent = interaction.options.getBoolean("silent") ?? false;

    const targetMember = await this.fetchGuildMember(interaction, targetUser.id);
    const actorMember = await this.fetchGuildMember(interaction, interaction.user.id);

    if (targetMember && actorMember && !canPunishMember(actorMember, targetMember)) {
      return interaction.editReply({ embeds: [this.hierarchyErrorEmbed()] });
    }

    const targetLinked = await new UserGetter().byDiscordId(targetUser.id);

    const dmStatus = await sendPunishmentDm(targetUser, {
      type: "PERM_BAN",
      reason,
      guildName: interaction.guild.name,
      expiresAt: null,
    });

    try {
      await interaction.guild.members.ban(targetUser.id, {
        reason: `[Punish] ${reason}`,
        deleteMessageSeconds: 0,
      });
    } catch (error) {
      console.error("Failed to ban member:", error);
      return interaction.editReply({
        content: "Failed to ban the user. The bot may lack permissions.",
      });
    }

    const punishmentId = await createPunishment({
      type: "PERM_BAN",
      targetDiscordUserId: targetUser.id,
      targetDiscordTag: getTargetTag(targetUser),
      targetPlayerId: targetLinked?.userId || null,
      actorDiscordUserId: interaction.user.id,
      actorNameSnapshot: getTargetTag(interaction.user),
      reason,
      expiresAt: null,
      context: this.buildContext(interaction, evidence),
      dmStatus,
    });

    if (!silent) {
      await sendLogEmbed(interaction.client, {
        type: "PERM_BAN",
        targetUser,
        actorUser: interaction.user,
        reason,
        expiresAt: null,
        punishmentId,
        dmStatus,
        silent,
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("User Permanently Banned")
          .setDescription(
            `<@${targetUser.id}> has been permanently banned.\n**Reason:** ${reason}\n**DM Status:** ${dmStatus}\n**Punishment ID:** ${punishmentId}`
          )
          .setColor(Colors.DarkRed)
          .setTimestamp(new Date()),
      ],
    });
  }

  async handleTempMute(interaction, actorLinked) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const durationStr = interaction.options.getString("duration");
    const evidence = interaction.options.getString("evidence");
    const silent = interaction.options.getBoolean("silent") ?? false;

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.editReply({
        content: "Invalid duration. Use formats like `30m`, `1h`, `7d`, `2w`.",
      });
    }

    const targetMember = await this.fetchGuildMember(interaction, targetUser.id);
    const actorMember = await this.fetchGuildMember(interaction, interaction.user.id);

    if (targetMember && actorMember && !canPunishMember(actorMember, targetMember)) {
      return interaction.editReply({ embeds: [this.hierarchyErrorEmbed()] });
    }

    if (!targetMember) {
      return interaction.editReply({
        content: "That user is not currently in the guild and cannot be muted.",
      });
    }

    if (!MUTED_ROLE_ID) {
      return interaction.editReply({
        content: "Muted role is not configured. Please set `discord.roles.muted` in config.",
      });
    }

    const expiresAt = new Date(Date.now() + durationMs);
    const targetLinked = await new UserGetter().byDiscordId(targetUser.id);

    const dmStatus = await sendPunishmentDm(targetUser, {
      type: "TEMP_MUTE",
      reason,
      guildName: interaction.guild.name,
      expiresAt,
    });

    try {
      await targetMember.roles.add(MUTED_ROLE_ID, `[Punish] ${reason}`);
    } catch (error) {
      console.error("Failed to apply muted role:", error);
      return interaction.editReply({
        content: "Failed to apply the muted role. The bot may lack permissions or the role is misconfigured.",
      });
    }

    const punishmentId = await createPunishment({
      type: "TEMP_MUTE",
      targetDiscordUserId: targetUser.id,
      targetDiscordTag: getTargetTag(targetUser),
      targetPlayerId: targetLinked?.userId || null,
      actorDiscordUserId: interaction.user.id,
      actorNameSnapshot: getTargetTag(interaction.user),
      reason,
      expiresAt,
      context: this.buildContext(interaction, evidence),
      dmStatus,
    });

    if (!silent) {
      await sendLogEmbed(interaction.client, {
        type: "TEMP_MUTE",
        targetUser,
        actorUser: interaction.user,
        reason,
        expiresAt,
        punishmentId,
        dmStatus,
        silent,
      });
    }

    const unixTs = Math.floor(expiresAt.getTime() / 1000);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("User Temporarily Muted")
          .setDescription(
            `<@${targetUser.id}> has been temporarily muted.\n**Reason:** ${reason}\n**Expires:** <t:${unixTs}:F> (<t:${unixTs}:R>)\n**DM Status:** ${dmStatus}\n**Punishment ID:** ${punishmentId}`
          )
          .setColor(Colors.DarkGrey)
          .setTimestamp(new Date()),
      ],
    });
  }

  async handlePermMute(interaction, actorLinked) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    const evidence = interaction.options.getString("evidence");
    const silent = interaction.options.getBoolean("silent") ?? false;

    const targetMember = await this.fetchGuildMember(interaction, targetUser.id);
    const actorMember = await this.fetchGuildMember(interaction, interaction.user.id);

    if (targetMember && actorMember && !canPunishMember(actorMember, targetMember)) {
      return interaction.editReply({ embeds: [this.hierarchyErrorEmbed()] });
    }

    if (!targetMember) {
      return interaction.editReply({
        content: "That user is not currently in the guild and cannot be muted.",
      });
    }

    if (!MUTED_ROLE_ID) {
      return interaction.editReply({
        content: "Muted role is not configured. Please set `discord.roles.muted` in config.",
      });
    }

    const targetLinked = await new UserGetter().byDiscordId(targetUser.id);

    const dmStatus = await sendPunishmentDm(targetUser, {
      type: "PERM_MUTE",
      reason,
      guildName: interaction.guild.name,
      expiresAt: null,
    });

    try {
      await targetMember.roles.add(MUTED_ROLE_ID, `[Punish] ${reason}`);
    } catch (error) {
      console.error("Failed to apply muted role:", error);
      return interaction.editReply({
        content: "Failed to apply the muted role. The bot may lack permissions or the role is misconfigured.",
      });
    }

    const punishmentId = await createPunishment({
      type: "PERM_MUTE",
      targetDiscordUserId: targetUser.id,
      targetDiscordTag: getTargetTag(targetUser),
      targetPlayerId: targetLinked?.userId || null,
      actorDiscordUserId: interaction.user.id,
      actorNameSnapshot: getTargetTag(interaction.user),
      reason,
      expiresAt: null,
      context: this.buildContext(interaction, evidence),
      dmStatus,
    });

    if (!silent) {
      await sendLogEmbed(interaction.client, {
        type: "PERM_MUTE",
        targetUser,
        actorUser: interaction.user,
        reason,
        expiresAt: null,
        punishmentId,
        dmStatus,
        silent,
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("User Permanently Muted")
          .setDescription(
            `<@${targetUser.id}> has been permanently muted.\n**Reason:** ${reason}\n**DM Status:** ${dmStatus}\n**Punishment ID:** ${punishmentId}`
          )
          .setColor(Colors.DarkGrey)
          .setTimestamp(new Date()),
      ],
    });
  }

  async handleUnban(interaction, actorLinked) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    // Find active ban punishments for this user
    const activeBans = await getActivePunishments(targetUser.id);
    const banRecords = activeBans.filter(
      (p) => p.type === "TEMP_BAN" || p.type === "PERM_BAN"
    );

    try {
      await interaction.guild.members.unban(targetUser.id, `[Punish] ${reason}`);
    } catch (error) {
      // User may not actually be banned in Discord
      console.warn("Failed to unban (may not be banned):", error.message);
    }

    // Lift all active ban records
    for (const ban of banRecords) {
      await liftPunishment(ban.id);
    }

    if (LOG_CHANNEL_ID) {
      try {
        const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
        if (channel?.isTextBased?.()) {
          const embed = new EmbedBuilder()
            .setTitle("User Unbanned")
            .setDescription(
              `<@${targetUser.id}> has been unbanned by <@${interaction.user.id}>.\n**Reason:** ${reason}`
            )
            .setColor(Colors.Green)
            .setTimestamp(new Date());
          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error("Failed to send unban log:", err);
      }
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("User Unbanned")
          .setDescription(
            `<@${targetUser.id}> has been unbanned.\n**Reason:** ${reason}\n**Records lifted:** ${banRecords.length}`
          )
          .setColor(Colors.Green)
          .setTimestamp(new Date()),
      ],
    });
  }

  async handleUnmute(interaction, actorLinked) {
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    const targetMember = await this.fetchGuildMember(interaction, targetUser.id);

    if (targetMember && MUTED_ROLE_ID) {
      try {
        await targetMember.roles.remove(MUTED_ROLE_ID, `[Punish] ${reason}`);
      } catch (error) {
        console.warn("Failed to remove muted role:", error.message);
      }
    }

    const activeMutes = await getActivePunishments(targetUser.id);
    const muteRecords = activeMutes.filter(
      (p) => p.type === "TEMP_MUTE" || p.type === "PERM_MUTE"
    );

    for (const mute of muteRecords) {
      await liftPunishment(mute.id);
    }

    if (LOG_CHANNEL_ID) {
      try {
        const channel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
        if (channel?.isTextBased?.()) {
          const embed = new EmbedBuilder()
            .setTitle("User Unmuted")
            .setDescription(
              `<@${targetUser.id}> has been unmuted by <@${interaction.user.id}>.\n**Reason:** ${reason}`
            )
            .setColor(Colors.Green)
            .setTimestamp(new Date());
          await channel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error("Failed to send unmute log:", err);
      }
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("User Unmuted")
          .setDescription(
            `<@${targetUser.id}> has been unmuted.\n**Reason:** ${reason}\n**Records lifted:** ${muteRecords.length}`
          )
          .setColor(Colors.Green)
          .setTimestamp(new Date()),
      ],
    });
  }

  async handleHistory(interaction) {
    const targetUser = interaction.options.getUser("user");

    const history = await getPunishmentHistory(targetUser.id, 25);

    if (!history.length) {
      return interaction.editReply({
        content: `<@${targetUser.id}> has no Discord punishment records.`,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Discord Punishments for ${getTargetTag(targetUser)}`)
      .setColor(Colors.DarkRed)
      .setTimestamp(new Date())
      .setDescription(`Total records: ${history.length}`)
      .setFooter({ text: `Showing up to 25 most recent` });

    const fields = history.slice(0, 25).map((p, i) => {
      const lines = [];
      lines.push(`**Type:** ${formatType(p.type)}`);
      lines.push(`**Reason:** ${(p.reason || "N/A").slice(0, 200)}`);
      lines.push(`**Status:** ${p.status}`);
      lines.push(`**Date:** ${formatDiscordTimestamp(p.created_at, { fallback: "Unknown" })}`);

      if (p.expires_at) {
        lines.push(`**Expires:** ${formatDiscordTimestamp(p.expires_at, { fallback: "N/A" })}`);
      }

      if (p.actor_name_snapshot) {
        lines.push(`**Staff:** ${p.actor_name_snapshot}`);
      }

      return {
        name: `${i + 1}. ${formatType(p.type)} (ID: ${p.id})`,
        value: lines.join("\n").slice(0, 1024),
      };
    });

    // Discord embeds max 25 fields, max total 6000 chars
    let totalChars = embed.data.title.length + (embed.data.description?.length || 0);
    const safeFields = [];
    for (const field of fields) {
      const fieldChars = field.name.length + field.value.length;
      if (totalChars + fieldChars > 5800) break;
      totalChars += fieldChars;
      safeFields.push(field);
    }

    if (safeFields.length) {
      embed.addFields(safeFields);
    }

    return interaction.editReply({ embeds: [embed] });
  }

  async fetchGuildMember(interaction, userId) {
    try {
      return await interaction.guild.members.fetch(userId);
    } catch {
      return null;
    }
  }

  buildContext(interaction, evidence) {
    const ctx = {
      channelId: interaction.channelId,
      guildId: interaction.guildId,
    };

    if (evidence) {
      ctx.evidence = evidence;
    }

    return ctx;
  }

  hierarchyErrorEmbed() {
    return new EmbedBuilder()
      .setTitle("Cannot Punish User")
      .setDescription(
        "You cannot punish this user because they have an equal or higher role than you."
      )
      .setColor(Colors.Red);
  }
}
