/**
 * voteRewardService.js
 *
 * Defines the reward command templates for instant vote rewards and
 * monthly winner rewards.  Edit the arrays below to customise what
 * commands are queued — no other files need to change.
 *
 * Placeholders supported in command_text:
 *   {player}     — player's current username
 *   {uuid}       — player's UUID
 *   {month}      — YYYY-MM of the relevant month
 *   {voteCount}  — player's vote total for that month (monthly only)
 */

import { buildQueueDedupeKey } from "../controllers/voteController.js";

// ---------------------------------------------------------------------------
// Instant vote reward templates
// Executed when a vote is received (one entry per command template).
// ---------------------------------------------------------------------------
const VOTE_REWARD_TEMPLATES = [
  {
    commandTemplate: "crate key give {player} vote 1",
    executeAs: "console",
    serverScope: "any",
  },
  {
    commandTemplate: "eco give {player} 250",
    executeAs: "console",
    serverScope: "any",
  },
];

// ---------------------------------------------------------------------------
// Monthly top-voter reward templates
// Executed once per winner when monthly processing runs.
// ---------------------------------------------------------------------------
const MONTHLY_REWARD_TEMPLATES = [
  {
    commandTemplate: "lp user {player} parent addtemp topvoter 30d",
    executeAs: "console",
    serverScope: "any",
  },
  {
    commandTemplate: "broadcast &6[Vote] &e{player} &awon top voter for &6{month}&a! Congratulations!",
    executeAs: "console",
    serverScope: "any",
  },
  {
    commandTemplate: "crate key give {player} vote 10",
    executeAs: "console",
    serverScope: "any",
  },
];

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
// Exported builders
// ---------------------------------------------------------------------------

/**
 * Build reward queue entries for a single accepted vote.
 *
 * @param {{ playerUuid, playerName, siteName, serviceName, voteId, receivedAt }} opts
 * @returns {Array} Entries ready to pass to enqueueCommands()
 */
export function buildVoteRewardCommands({ playerUuid, playerName, siteName, serviceName, voteId, receivedAt }) {
  const source = "vote_reward";
  const dateStr = (receivedAt instanceof Date ? receivedAt : new Date(receivedAt)).toISOString().slice(0, 10);

  return VOTE_REWARD_TEMPLATES.map((tpl, index) => {
    const commandText = resolvePlaceholders(tpl.commandTemplate, { playerName, playerUuid });
    // Dedupe key includes voteId + template index so each vote generates its own unique entries.
    const dedupeKey = buildQueueDedupeKey(playerUuid, `${source}:${voteId}:${index}`, commandText);

    return {
      playerUuid,
      playerName,
      source,
      commandText,
      executeAs: tpl.executeAs,
      serverScope: tpl.serverScope,
      dedupeKey,
      availableAt: receivedAt,
    };
  });
}

/**
 * Build monthly winner reward queue entries.
 *
 * @param {{ playerUuid, playerName, monthKey, voteCount }} opts
 * @returns {Array} Entries ready to pass to enqueueCommands()
 */
export function buildMonthlyRewardCommands({ playerUuid, playerName, monthKey, voteCount }) {
  const source = "monthly_reward";

  return MONTHLY_REWARD_TEMPLATES.map((tpl, index) => {
    const commandText = resolvePlaceholders(tpl.commandTemplate, { playerName, playerUuid, monthKey, voteCount });
    // Dedupe key includes monthKey so re-running the job for the same month is idempotent.
    const dedupeKey = buildQueueDedupeKey(playerUuid, `${source}:${monthKey}:${index}`, commandText);

    return {
      playerUuid,
      playerName,
      source,
      commandText,
      executeAs: tpl.executeAs,
      serverScope: tpl.serverScope,
      dedupeKey,
      availableAt: new Date(),
    };
  });
}
