/**
 * Pure eligibility rule evaluator — no I/O, no DB imports.
 * Accepts pre-fetched user data and applies the configured rules.
 * Importable in tests without any DB or Prisma dependencies.
 */

function buildEmptySnapshot() {
  return {
    playtime_hours: null,
    currently_banned: null,
    ever_banned: null,
    punishments_in_lookback: null,
    platform_ban_sources: null,
    discord_message_count: null,
  };
}

/**
 * @param {object} rules  Row from application_eligibility_rules
 * @param {object} data   Pre-fetched user data:
 *   - hasMinecraftAccount {boolean}
 *   - playtimeHours       {number}
 *   - currentlyBanned     {boolean}
 *   - everBanned          {boolean}
 *   - punishmentsInLookback {number}
 *   - platformBanned      {boolean}
 *   - platformBanSources  {string[]}
 *   - hasDiscordAccount   {boolean}
 *   - discordMessageCount {number}
 * @returns {{ eligible: boolean, failedRules: Array, snapshot: object }}
 */
export function evaluateEligibilityRules(rules, data) {
  const failedRules = [];
  const snapshot = buildEmptySnapshot();

  // 1. Minecraft / playtime
  if (rules.minimum_playtime_hours !== null) {
    if (!data.hasMinecraftAccount) {
      failedRules.push({
        code: "NO_LINKED_MINECRAFT_ACCOUNT",
        message: "You must have a linked Minecraft account to apply for this role.",
      });
      snapshot.playtime_hours = 0;
    } else {
      snapshot.playtime_hours = data.playtimeHours;
      if (data.playtimeHours < rules.minimum_playtime_hours) {
        failedRules.push({
          code: "MINIMUM_PLAYTIME_NOT_MET",
          message: `You need at least ${rules.minimum_playtime_hours} hour${rules.minimum_playtime_hours !== 1 ? "s" : ""} of in-game activity to apply. You currently have ${data.playtimeHours} hour${data.playtimeHours !== 1 ? "s" : ""}.`,
          required: rules.minimum_playtime_hours,
          current: data.playtimeHours,
        });
      }
    }
  }

  // 2. Currently banned
  if (rules.block_if_currently_banned) {
    snapshot.currently_banned = data.currentlyBanned;
    if (data.currentlyBanned) {
      failedRules.push({
        code: "CURRENTLY_BANNED",
        message: "You must not have an active ban to apply for this role.",
      });
    }
  }

  // 3. Ever banned
  if (rules.block_if_ever_banned) {
    snapshot.ever_banned = data.everBanned;
    if (data.everBanned) {
      failedRules.push({
        code: "EVER_BANNED",
        message: "You must never have received a ban to apply for this role.",
      });
    }
  }

  // 4. Punishment lookback
  if (rules.punishment_lookback_months !== null) {
    snapshot.punishments_in_lookback = data.punishmentsInLookback;
    const maxAllowed = rules.max_punishments_in_lookback ?? 0;
    if (data.punishmentsInLookback > maxAllowed) {
      const period = `${rules.punishment_lookback_months} month${rules.punishment_lookback_months !== 1 ? "s" : ""}`;
      if (maxAllowed === 0) {
        failedRules.push({
          code: "PUNISHMENTS_IN_LOOKBACK",
          message: `You must not have any punishments within the last ${period} to apply for this role.`,
          lookbackMonths: rules.punishment_lookback_months,
          count: data.punishmentsInLookback,
          maxAllowed,
        });
      } else {
        failedRules.push({
          code: "TOO_MANY_PUNISHMENTS_IN_LOOKBACK",
          message: `You must not have more than ${maxAllowed} punishment${maxAllowed !== 1 ? "s" : ""} within the last ${period}. You currently have ${data.punishmentsInLookback}.`,
          lookbackMonths: rules.punishment_lookback_months,
          count: data.punishmentsInLookback,
          maxAllowed,
        });
      }
    }
  }

  // 5. Platform-wide ban
  if (rules.block_if_banned_on_any_platform) {
    snapshot.platform_ban_sources = data.platformBanSources;
    if (data.platformBanned) {
      failedRules.push({
        code: "BANNED_ON_PLATFORM",
        message: "You must not be banned on any Crafting For Christ platform to apply for this role.",
        sources: data.platformBanSources,
      });
    }
  }

  // 6. Discord activity
  if (rules.require_discord_activity) {
    if (!data.hasDiscordAccount) {
      failedRules.push({
        code: "NO_LINKED_DISCORD_ACCOUNT",
        message: "You must have a linked Discord account to apply for this role.",
      });
      snapshot.discord_message_count = 0;
    } else {
      const lookbackDays = rules.discord_activity_lookback_days ?? 30;
      const minMessages = rules.minimum_discord_messages ?? 1;
      snapshot.discord_message_count = data.discordMessageCount;
      if (data.discordMessageCount < minMessages) {
        failedRules.push({
          code: "INSUFFICIENT_DISCORD_ACTIVITY",
          message: `You need at least ${minMessages} Discord community interaction${minMessages !== 1 ? "s" : ""} in the last ${lookbackDays} day${lookbackDays !== 1 ? "s" : ""}. You currently have ${data.discordMessageCount}.`,
          required: minMessages,
          current: data.discordMessageCount,
          lookbackDays,
        });
      }
    }
  }

  return { eligible: failedRules.length === 0, failedRules, snapshot };
}
