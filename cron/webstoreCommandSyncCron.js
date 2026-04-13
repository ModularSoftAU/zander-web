/**
 * webstoreCommandSyncCron.js
 *
 * Periodically syncs the status of webstoreCommandRuns with their underlying
 * executorTasks, then marks purchases fulfilled or failed based on whether all
 * their commands have completed.
 *
 * Runs every 5 minutes.
 *
 * States:
 *   queued      → waiting for zander-addon to pick up the executorTask
 *   processing  → zander-addon has claimed the task and is executing it
 *   completed   → task executed successfully
 *   failed      → all retries exhausted; purchase marked failed
 *
 * Failed tasks are automatically retried up to MAX_RETRIES times by resetting
 * the executorTask to 'pending'.
 */

import cron from "node-cron";
import db from "../controllers/databaseController.js";
import {
  getCommandRunsNeedingSync,
  getPurchasesWithPendingCommandRuns,
  incrementCommandRunAttempts,
  resetExecutorTask,
  updateCommandRunStatus,
  updatePurchaseStatus,
} from "../controllers/webstoreController.js";

const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Sync individual command runs against their executor task statuses
// ---------------------------------------------------------------------------

async function syncCommandRuns() {
  let commandRuns;
  try {
    commandRuns = await getCommandRunsNeedingSync(100);
  } catch (err) {
    console.error("[webstore-cron] getCommandRunsNeedingSync failed:", err.message);
    return;
  }

  for (const run of commandRuns) {
    const taskStatus = run.taskStatus;
    if (!taskStatus) continue;

    try {
      if (taskStatus === "completed") {
        await updateCommandRunStatus(run.commandRunId, "completed");
        continue;
      }

      if (taskStatus === "processing") {
        // Already in progress — update our local status to reflect this
        if (run.status !== "processing") {
          await updateCommandRunStatus(run.commandRunId, "processing");
        }
        continue;
      }

      if (taskStatus === "failed") {
        const nextAttempt = (run.attempts || 0) + 1;
        if (nextAttempt < MAX_RETRIES) {
          // Retry: reset the executor task and increment our attempt counter
          await incrementCommandRunAttempts(run.commandRunId, run.taskResult || "failed");
          await resetExecutorTask(run.executorTaskId);
        } else {
          // Exhausted retries — mark permanently failed
          await updateCommandRunStatus(
            run.commandRunId,
            "failed",
            run.taskResult || "Max retries reached"
          );
        }
        continue;
      }

      // 'pending' or unknown — keep as queued
    } catch (err) {
      console.error(
        `[webstore-cron] Error syncing commandRunId ${run.commandRunId}:`,
        err.message
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Roll up command run statuses to the parent purchase
// ---------------------------------------------------------------------------

async function syncPurchaseStatuses() {
  let purchases;
  try {
    purchases = await getPurchasesWithPendingCommandRuns();
  } catch (err) {
    console.error("[webstore-cron] getPurchasesWithPendingCommandRuns failed:", err.message);
    return;
  }

  for (const { purchaseId } of purchases) {
    try {
      const rows = await new Promise((resolve, reject) => {
        db.query(
          "SELECT status FROM webstoreCommandRuns WHERE purchaseId = ?",
          [purchaseId],
          (err, results) => (err ? reject(err) : resolve(results))
        );
      });

      if (!rows.length) continue;

      const statuses = rows.map((r) => r.status);
      const allCompleted = statuses.every((s) => s === "completed");
      const anyFailed = statuses.some((s) => s === "failed");
      const anyPending = statuses.some((s) => s === "queued" || s === "processing");

      if (allCompleted) {
        await updatePurchaseStatus(purchaseId, "fulfilled");
      } else if (anyFailed && !anyPending) {
        // All runs have settled but at least one failed — mark purchase failed
        await updatePurchaseStatus(purchaseId, "failed");
      }
      // Otherwise leave the purchase as 'paid' while commands are still running
    } catch (err) {
      console.error(`[webstore-cron] Error syncing purchaseId ${purchaseId}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

const task = cron.schedule("*/5 * * * *", async () => {
  await syncCommandRuns();
  await syncPurchaseStatuses();
});

task.start();
