import { EmbedBuilder } from "discord.js";
import { UserGetter } from "../../controllers/userController.js";

const userGetter = new UserGetter();

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
