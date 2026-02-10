import cron from "node-cron";
import { EmbedBuilder } from "discord.js";
import { client } from "../controllers/discordController.js";
import db from "../controllers/databaseController.js";
import { isNicknameSimilar } from "../lib/discord/nicknameCheck.mjs";
import pLimit from "p-limit";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

const limit = pLimit(5);

function getAllLinkedUsers() {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT discordId, username FROM users WHERE discordId IS NOT NULL AND username IS NOT NULL;`,
      (error, results) => {
        if (error) return reject(error);
        resolve(results || []);
      }
    );
  });
}

async function runNicknameCheck() {
  if (!features.discord.events.nicknameCheck) return;

  const reportChannelId = config.discord.nicknameReportChannelId;
  if (!reportChannelId) {
    console.warn("[NicknameCheckCron] No nicknameReportChannelId configured. Skipping.");
    return;
  }

  const guildId = config.discord.guildId;
  if (!guildId) {
    console.warn("[NicknameCheckCron] No guildId configured. Skipping.");
    return;
  }

  const guild = await client.guilds.fetch(guildId);
  if (!guild) {
    console.error("[NicknameCheckCron] Could not fetch guild.");
    return;
  }

  const channel = await client.channels.fetch(reportChannelId);
  if (!channel) {
    console.error(`[NicknameCheckCron] Could not find report channel ${reportChannelId}.`);
    return;
  }

  const linkedUsers = await getAllLinkedUsers();
  if (!linkedUsers.length) {
    console.log("[NicknameCheckCron] No linked users found.");
    return;
  }

  const mismatches = [];

  await Promise.all(
    linkedUsers.map((user) =>
      limit(async () => {
        try {
          const member = await guild.members.fetch(user.discordId);
          if (!member || member.user.bot) return;

          const displayName =
            member.nickname || member.user.globalName || member.user.username;

          if (!isNicknameSimilar(displayName, user.username)) {
            mismatches.push({
              discordId: user.discordId,
              discordUsername: member.user.username,
              displayName,
              minecraftUsername: user.username,
            });
          }
        } catch (err) {
          // Member may have left the guild, skip silently
          if (err.code !== 10007) {
            console.error(
              `[NicknameCheckCron] Error fetching member ${user.discordId}:`,
              err.message
            );
          }
        }
      })
    )
  );

  if (!mismatches.length) {
    console.log("[NicknameCheckCron] All linked users have valid nicknames.");
    return;
  }

  // Build embeds in batches (max 25 fields per embed)
  const FIELDS_PER_EMBED = 25;

  for (let i = 0; i < mismatches.length; i += FIELDS_PER_EMBED) {
    const batch = mismatches.slice(i, i + FIELDS_PER_EMBED);

    const embed = new EmbedBuilder()
      .setTitle("Scheduled Nickname Check")
      .setDescription(
        `Found **${mismatches.length}** user(s) whose Discord name does not match their Minecraft username.`
      )
      .setColor("#ff9900")
      .setTimestamp();

    for (const m of batch) {
      embed.addFields({
        name: m.minecraftUsername,
        value: `<@${m.discordId}> (${m.discordUsername})\nDisplay Name: **${m.displayName}**`,
        inline: true,
      });
    }

    if (mismatches.length > FIELDS_PER_EMBED) {
      embed.setFooter({
        text: `Page ${Math.floor(i / FIELDS_PER_EMBED) + 1} of ${Math.ceil(mismatches.length / FIELDS_PER_EMBED)}`,
      });
    }

    await channel.send({ embeds: [embed] });
  }

  console.log(
    `[NicknameCheckCron] Reported ${mismatches.length} nickname mismatch(es).`
  );
}

// Run every 6 hours
const nicknameCheckTask = cron.schedule("0 */6 * * *", async () => {
  try {
    await runNicknameCheck();
  } catch (error) {
    console.error("[NicknameCheckCron] Failed to run nickname check:", error);
  }
});

nicknameCheckTask.start();

console.log("[NicknameCheckCron] Scheduled nickname check every 6 hours.");
