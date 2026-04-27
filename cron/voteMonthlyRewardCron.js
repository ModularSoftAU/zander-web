/**
 * voteMonthlyRewardCron.js
 *
 * Runs at 00:05 UTC on the 1st of every month.
 * Calculates the previous month's top voter(s) and queues their rewards.
 *
 * Tie rule: ALL players sharing the highest vote count receive the monthly
 * reward.  Within a tie group they are ordered by earliest last_vote_at
 * (i.e. whoever cast their final vote first).
 *
 * Idempotency: The job checks vote_monthly_results before inserting.
 * Running it twice for the same month is safe — the second run is a no-op.
 */

import cron from "node-cron";
import {
  getMonthlyWinners,
  monthlyRewardsAlreadyGenerated,
  recordMonthlyResults,
  enqueueCommands,
} from "../controllers/voteController.js";
import { buildMonthlyRewardCommands } from "../services/voteRewardService.js";

/**
 * Derive the YYYY-MM string for the month immediately before `now`.
 */
function previousMonthKey(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function processMonthlyVoteRewards(monthKey) {
  console.log(`[voteMonthlyRewardCron] Processing monthly vote rewards for ${monthKey}…`);

  // Idempotency guard — do nothing if already processed.
  const alreadyDone = await monthlyRewardsAlreadyGenerated(monthKey);
  if (alreadyDone) {
    console.log(`[voteMonthlyRewardCron] Rewards for ${monthKey} already generated. Skipping.`);
    return;
  }

  const winners = await getMonthlyWinners(monthKey);
  if (!winners.length) {
    console.log(`[voteMonthlyRewardCron] No votes found for ${monthKey}. Nothing to reward.`);
    return;
  }

  const allCommands = [];
  for (const winner of winners) {
    const cmds = await buildMonthlyRewardCommands({
      playerUuid: winner.player_uuid,
      playerName: winner.player_name,
      monthKey,
      voteCount: winner.vote_count,
    });
    allCommands.push(...cmds);
  }

  await enqueueCommands(allCommands);
  await recordMonthlyResults(monthKey, winners);

  console.log(
    `[voteMonthlyRewardCron] Done for ${monthKey}: ${winners.length} winner(s), ${allCommands.length} command(s) queued.`
  );
}

// Schedule: 00:05 UTC on the 1st of each month.
// The 5-minute offset avoids any midnight clock-skew edge cases.
const monthlyVoteRewardTask = cron.schedule(
  "5 0 1 * *",
  async () => {
    try {
      const monthKey = previousMonthKey();
      await processMonthlyVoteRewards(monthKey);
    } catch (error) {
      console.error("[voteMonthlyRewardCron] Unexpected error:", error);
    }
  },
  { timezone: "UTC" }
);

monthlyVoteRewardTask.start();
