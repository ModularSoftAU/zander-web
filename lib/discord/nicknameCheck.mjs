import { EmbedBuilder } from "discord.js";
import { UserGetter } from "../../controllers/userController.js";
import db from "../../controllers/databaseController.js";
import pLimit from "p-limit";

const userGetter = new UserGetter();
const limit = pLimit(5);

/**
 * Strips non-alphanumeric characters and lowercases a string for comparison.
 */
function normalize(str) {
  return str.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

/**
 * Checks whether a Discord display name is similar enough to a Minecraft username.
 *
 * Returns true if the nickname is considered valid (similar to the MC name).
 * Checks:
 *  1. Normalized exact match
 *  2. One string contains the other
 */
export function isNicknameSimilar(discordName, minecraftUsername) {
  const normDiscord = normalize(discordName);
  const normMC = normalize(minecraftUsername);

  if (!normDiscord || !normMC) return false;

  // Exact match after normalization
  if (normDiscord === normMC) return true;

  // One contains the other
  if (normDiscord.includes(normMC) || normMC.includes(normDiscord)) return true;

  return false;
}

/**
 * Gets the effective display name for a guild member.
 * Prefers the server nickname, falls back to global display name, then username.
 */
function getDisplayName(member) {
  return member.nickname || member.user.globalName || member.user.username;
}

/**
 * Checks a guild member's Discord nickname against their linked Minecraft username.
 * If the nickname does not match, sends a report to the configured channel.
 *
 * @param {GuildMember} member - The Discord guild member to check.
 * @param {string} reportChannelId - The channel ID to send reports to.
 * @param {string} [trigger="Nickname Change"] - What triggered this check.
 */
export async function checkAndReportNickname(member, reportChannelId, trigger = "Nickname Change") {
  try {
    const user = await userGetter.byDiscordId(member.id);

    // User has no linked account, nothing to check
    if (!user || !user.username) return;

    const displayName = getDisplayName(member);
    const minecraftUsername = user.username;

    if (isNicknameSimilar(displayName, minecraftUsername)) return;

    // Nickname does not match - send report
    const channel = await member.client.channels.fetch(reportChannelId);
    if (!channel) {
      console.error(`[NicknameCheck] Could not find report channel ${reportChannelId}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Nickname Mismatch Detected")
      .setColor("#ff9900")
      .addFields(
        { name: "Discord User", value: `<@${member.id}> (${member.user.username})`, inline: true },
        { name: "Display Name", value: displayName, inline: true },
        { name: "Minecraft Username", value: minecraftUsername, inline: true },
        { name: "Trigger", value: trigger, inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("[NicknameCheck] Failed to check nickname:", error);
  }
}

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

/**
 * Scans all linked users in the guild and returns mismatches.
 * Optionally sends report embeds to the given channel.
 *
 * @param {Client} discordClient - The Discord.js client instance.
 * @param {string} guildId - The guild to scan.
 * @param {object} [options]
 * @param {string} [options.reportChannelId] - Channel to send results to. If omitted, results are only returned.
 * @param {string} [options.title="Nickname Check"] - Title for the report embeds.
 * @returns {Promise<Array>} Array of mismatch objects.
 */
export async function runBulkNicknameCheck(discordClient, guildId, { reportChannelId = null, title = "Nickname Check" } = {}) {
  const guild = await discordClient.guilds.fetch(guildId);
  if (!guild) throw new Error("Could not fetch guild.");

  const linkedUsers = await getAllLinkedUsers();
  if (!linkedUsers.length) return [];

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
          // Member may have left the guild — error code 10007
          if (err.code !== 10007) {
            console.error(
              `[NicknameCheck] Error fetching member ${user.discordId}:`,
              err.message
            );
          }
        }
      })
    )
  );

  if (reportChannelId && mismatches.length) {
    const channel = await discordClient.channels.fetch(reportChannelId);
    if (!channel) {
      console.error(`[NicknameCheck] Could not find report channel ${reportChannelId}.`);
      return mismatches;
    }

    const FIELDS_PER_EMBED = 25;

    for (let i = 0; i < mismatches.length; i += FIELDS_PER_EMBED) {
      const batch = mismatches.slice(i, i + FIELDS_PER_EMBED);

      const embed = new EmbedBuilder()
        .setTitle(title)
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
  }

  return mismatches;
}
