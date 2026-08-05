import { EmbedBuilder, Colors } from "discord.js";
import db from "./databaseController.js";
import { maskIp } from "../lib/discord/ipCheckFormat.mjs";

export function recordAuditLog({
  discordUserId,
  discordTag,
  permissionNode,
  queryType,
  searchTarget,
  resultCount,
  success,
  guildId,
  channelId,
}) {
  return new Promise((resolve, reject) => {
    db.query(
      `
        INSERT INTO ip_check_audit_log
            (discord_user_id, discord_tag, permission_node_matched, query_type, search_target, result_count, success, guild_id, channel_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [discordUserId, discordTag, permissionNode, queryType, searchTarget, resultCount, success, guildId, channelId],
      function (error) {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

export async function sendAuditEmbed(client, auditChannelId, { discordUserId, discordTag, queryType, searchTarget, resultCount, success }) {
  if (!auditChannelId) return;

  try {
    const channel = await client.channels.fetch(auditChannelId);
    if (!channel?.isTextBased?.()) return;

    const displayTarget = queryType === "IP" ? maskIp(searchTarget) : searchTarget;

    const embed = new EmbedBuilder()
      .setTitle("IP Check Executed")
      .setColor(success ? Colors.Blurple : Colors.Red)
      .addFields(
        { name: "Staff Member", value: `<@${discordUserId}> (${discordTag})`, inline: true },
        { name: "Query Type", value: queryType, inline: true },
        { name: "Target", value: displayTarget, inline: true },
        { name: "Results", value: String(resultCount), inline: true },
        { name: "Success", value: success ? "Yes" : "No", inline: true }
      )
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("[ipcheck] Failed to send audit embed:", err.message);
  }
}
