/**
 * voteMonthlyRewardCron.js
 *
 * Runs at 00:05 UTC on the 1st of every month.
 * For the previous month it:
 *   1. Queues reward commands for the top voter(s) via the bridge.
 *   2. Fires the configured bridge routine (e.g. announce rank in-game).
 *   3. Sends a Discord announcement embed to the configured channel.
 *
 * Tie rule: ALL players sharing the highest vote count receive the monthly
 * reward.  Within a tie group they are ordered by earliest last_vote_at.
 *
 * Idempotency: checks vote_monthly_results before doing anything.
 * Running it twice for the same month is safe.
 *
 * Config keys used (config.json → "voting"):
 *   announcementChannelId  — Discord channel ID for the winner announcement
 *   monthlyRoutineSlug     — Bridge routine slug to fire (optional)
 */

import cron from "node-cron";
import { createRequire } from "module";
import { EmbedBuilder } from "discord.js";
import { client } from "../controllers/discordController.js";
import db from "../controllers/databaseController.js";
import {
  getMonthlyWinners,
  monthlyRewardsAlreadyGenerated,
  recordMonthlyResults,
  enqueueCommands,
} from "../controllers/voteController.js";
import { buildMonthlyRewardCommands } from "../services/voteRewardService.js";

const require = createRequire(import.meta.url);
const config = require("../config.json");

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

/**
 * Derive the YYYY-MM string for the month immediately before `now`.
 */
function previousMonthKey(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Expand a bridge routine into executorTasks, substituting {{key}} placeholders
 * with values from the provided metadata object.
 */
async function fireRoutine(routineSlug, metadata = {}) {
  const routines = await query(
    "SELECT executorRoutineId FROM executorRoutines WHERE routineSlug = ? LIMIT 1",
    [routineSlug]
  );
  if (!routines.length) {
    console.warn(`[voteMonthlyRewardCron] Routine '${routineSlug}' not found — skipping.`);
    return 0;
  }

  const routineId = routines[0].executorRoutineId;
  const steps = await query(
    "SELECT slug, command, metadata FROM executorRoutineSteps WHERE executorRoutineId = ? ORDER BY stepOrder ASC",
    [routineId]
  );
  if (!steps.length) {
    console.warn(`[voteMonthlyRewardCron] Routine '${routineSlug}' has no steps — skipping.`);
    return 0;
  }

  let inserted = 0;
  for (const step of steps) {
    let cmd = step.command || "";
    for (const [k, v] of Object.entries(metadata)) {
      const ek = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const val = String(v ?? "");
      cmd = cmd.replace(new RegExp(`{{\\s*${ek}\\s*}}`, "gi"), val);
      cmd = cmd.replace(new RegExp(`(?<!\\{)\\{\\s*${ek}\\s*\\}(?!\\})`, "gi"), val);
    }
    cmd = cmd.replace(/^\/+/, "").trim();
    if (!cmd) continue;

    await query(
      `INSERT INTO executorTasks (slug, command, status, routineSlug, metadata, priority, createdAt, updatedAt)
       VALUES (?, ?, 'pending', ?, ?, 5, NOW(), NOW())`,
      [
        step.slug,
        cmd,
        routineSlug,
        JSON.stringify({ source: "monthly_vote_routine", ...metadata }),
      ]
    );
    inserted++;
  }

  console.log(`[voteMonthlyRewardCron] Fired routine '${routineSlug}' — ${inserted} task(s) queued.`);
  return inserted;
}

/**
 * Send a Discord embed announcing the monthly top voter(s).
 */
async function sendDiscordAnnouncement(winners, monthKey) {
  const channelId = config.voting?.announcementChannelId;
  if (!channelId) {
    console.log("[voteMonthlyRewardCron] No announcementChannelId configured — skipping Discord announcement.");
    return;
  }
  if (!client?.isReady?.()) {
    console.warn("[voteMonthlyRewardCron] Discord client not ready — skipping announcement.");
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased?.()) {
      console.warn(`[voteMonthlyRewardCron] Channel ${channelId} is not text-based — skipping.`);
      return;
    }

    const [year, month] = monthKey.split("-");
    const monthName = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleString("en-AU", { month: "long", year: "numeric" });

    const voteCount = winners[0]?.vote_count ?? 0;
    const nameList = winners.map((w) => `**${w.player_name}**`).join(", ");
    const plural = winners.length > 1;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top Voter${plural ? "s" : ""} — ${monthName}`)
      .setDescription(
        `Congratulations to ${nameList} for casting the most votes in ${monthName} ` +
        `with **${voteCount} vote${voteCount !== 1 ? "s" : ""}**!\n\n` +
        `Thank you to everyone who voted this month — every vote helps the server grow. 🎉`
      )
      .setColor(0xFFD700)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`[voteMonthlyRewardCron] Discord announcement sent for ${monthKey}.`);
  } catch (err) {
    console.error("[voteMonthlyRewardCron] Failed to send Discord announcement:", err.message);
  }
}

/**
 * Main processing function — also exported so it can be triggered manually
 * via POST /admin/vote/monthly/process.
 */
export async function processMonthlyVoteRewards(monthKey) {
  console.log(`[voteMonthlyRewardCron] Processing monthly vote rewards for ${monthKey}…`);

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

  // 1. Queue reward commands for each winner.
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

  // 2. Record results (idempotency guard for subsequent calls).
  await recordMonthlyResults(monthKey, winners);

  console.log(
    `[voteMonthlyRewardCron] Reward commands queued for ${monthKey}: ${winners.length} winner(s), ${allCommands.length} command(s).`
  );

  // 3. Fire the bridge routine (e.g. in-game announcement / rank assignment).
  const routineSlug = config.voting?.monthlyRoutineSlug;
  if (routineSlug) {
    const winnerNames = winners.map((w) => w.player_name).join(", ");
    const metaBase = {
      monthKey,
      playerName: winnerNames,
      username: winnerNames,        // alias so {username} placeholders resolve
      playerUuid: winners[0].player_uuid,
      voteCount: winners[0].vote_count,
    };
    await fireRoutine(routineSlug, metaBase);
  }

  // 4. Discord announcement.
  await sendDiscordAnnouncement(winners, monthKey);
}

// Schedule: 00:05 UTC on the 1st of each month.
const monthlyVoteRewardTask = cron.schedule(
  "5 0 1 * *",
  async () => {
    try {
      await processMonthlyVoteRewards(previousMonthKey());
    } catch (error) {
      console.error("[voteMonthlyRewardCron] Unexpected error:", error);
    }
  },
  { timezone: "UTC" }
);

monthlyVoteRewardTask.start();
