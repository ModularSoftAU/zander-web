import { Listener } from "@sapphire/framework";
import { AuditLogEvent } from "discord.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../config.json");
import {
  createPunishment,
} from "../controllers/discordPunishmentController.js";
import { UserGetter } from "../controllers/userController.js";
import { sendPunishmentWebhook, getTargetTag } from "../commands/punish.mjs";

export class GuildMemberRemoveListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "guildMemberRemove",
    });
  }

  async run(member) {
    // guildMemberRemove fires for both kicks AND voluntary leaves.
    // We check the audit log to determine if this was a kick.
    try {
      // Small delay to let the audit log entry populate
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const auditLogs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 5,
      });

      const entry = auditLogs.entries.find(
        (e) =>
          e.target?.id === member.user.id &&
          Date.now() - e.createdTimestamp < 10000
      );

      // No recent kick entry means the user left voluntarily — do nothing
      if (!entry) return;

      // If the executor is the bot itself, the /punish command already handled it
      if (entry.executor?.id === member.guild.members.me?.id) return;

      // This is a native Discord kick (right-click > Kick Member, or another bot)
      const executorTag = entry.executor
        ? getTargetTag(entry.executor)
        : "Unknown";
      const executorId = entry.executor?.id || "0";
      const reason = entry.reason || "No reason provided";

      // Look up linked player account
      const targetLinked = await new UserGetter().byDiscordId(member.user.id);

      await createPunishment({
        type: "DISCORD_KICK",
        targetDiscordUserId: member.user.id,
        targetDiscordTag: getTargetTag(member.user),
        targetPlayerId: targetLinked?.userId || null,
        actorDiscordUserId: executorId,
        actorNameSnapshot: executorTag,
        reason,
        expiresAt: null,
        context: { source: "native_discord_kick" },
        dmStatus: "NOT_APPLICABLE",
      });

      await sendPunishmentWebhook({
        type: "NATIVE_KICK",
        targetTag: getTargetTag(member.user),
        actorTag: executorTag,
        reason,
        durationMs: null,
      });
    } catch (error) {
      console.error("[Punishments] Failed to process native guildMemberRemove:", error);
    }
  }
}
