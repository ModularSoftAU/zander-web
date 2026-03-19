/**
 * voteRewardService.js
 *
 * Builds reward queue entries by loading active templates from the
 * vote_reward_templates database table at runtime.
 *
 * Reward types:
 *   'vote'         – fired for every accepted vote
 *   'monthly_top'  – fired for monthly top-voter winner(s)
 *
 * Supported placeholders in command_template:
 *   {player}     — player username
 *   {uuid}       — player UUID
 *   {month}      — YYYY-MM of the relevant month (monthly_top only)
 *   {voteCount}  — player's vote total for that month (monthly_top only)
 */

import { getRewardTemplates, buildQueueDedupeKey } from "../controllers/voteController.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolvePlaceholders(template, vars) {
  return template
    .replace(/\{player\}/gi, vars.playerName || "")
    .replace(/\{uuid\}/gi, vars.playerUuid || "")
    .replace(/\{month\}/gi, vars.monthKey || "")
    .replace(/\{voteCount\}/gi, String(vars.voteCount ?? ""));
}

// ---------------------------------------------------------------------------
// Exported builders (async — load templates from DB)
// ---------------------------------------------------------------------------

/**
 * Build reward queue entries for a single accepted vote.
 * Loads all active 'vote' templates from the database.
 *
 * @param {{ playerUuid, playerName, siteName, serviceName, voteId, receivedAt }} opts
 * @returns {Promise<Array>} Entries ready to pass to enqueueCommands()
 */
export async function buildVoteRewardCommands({ playerUuid, playerName, siteName, serviceName, voteId, receivedAt }) {
  const source = "vote_reward";
  const templates = await getRewardTemplates({ rewardType: "vote", activeOnly: true });

  return templates.map((tpl, index) => {
    const commandText = resolvePlaceholders(tpl.command_template, { playerName, playerUuid });
    // dedupe key includes voteId + template id so each vote generates its own unique entries.
    const dedupeKey = buildQueueDedupeKey(playerUuid, `${source}:${voteId}:${tpl.id}`, commandText);

    return {
      playerUuid,
      playerName,
      source,
      commandText,
      executeAs: tpl.execute_as,
      serverScope: tpl.server_scope,
      dedupeKey,
      availableAt: receivedAt,
    };
  });
}

/**
 * Build monthly winner reward queue entries.
 * Loads all active 'monthly_top' templates from the database.
 *
 * @param {{ playerUuid, playerName, monthKey, voteCount }} opts
 * @returns {Promise<Array>} Entries ready to pass to enqueueCommands()
 */
export async function buildMonthlyRewardCommands({ playerUuid, playerName, monthKey, voteCount }) {
  const source = "monthly_reward";
  const templates = await getRewardTemplates({ rewardType: "monthly_top", activeOnly: true });

  return templates.map((tpl) => {
    const commandText = resolvePlaceholders(tpl.command_template, { playerName, playerUuid, monthKey, voteCount });
    // dedupe key includes monthKey + template id so re-running the job for the same month is idempotent.
    const dedupeKey = buildQueueDedupeKey(playerUuid, `${source}:${monthKey}:${tpl.id}`, commandText);

    return {
      playerUuid,
      playerName,
      source,
      commandText,
      executeAs: tpl.execute_as,
      serverScope: tpl.server_scope,
      dedupeKey,
      availableAt: new Date(),
    };
  });
}
