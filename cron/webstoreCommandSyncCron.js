import cron from "node-cron";
import db from "../controllers/databaseController.js";
import {
  getCommandRunsForSync,
  getPurchasesNeedingFulfillment,
  incrementCommandRunAttempts,
  updateCommandRunForTask,
  updatePurchaseStatus,
} from "../controllers/webstoreController.js";

const MAX_RETRIES = 3;

function resetExecutorTask(taskId) {
  return new Promise((resolve, reject) => {
    db.query(
      "UPDATE executorTasks SET status = 'pending', executedBy = NULL, result = NULL, processedAt = NULL, updatedAt = NOW() WHERE executorTaskId = ?",
      [taskId],
      (error) => {
        if (error) return reject(error);
        return resolve(true);
      }
    );
  });
}

async function syncCommandRuns() {
  try {
    const commandRuns = await getCommandRunsForSync(100);

    for (const run of commandRuns) {
      const taskStatus = run.taskStatus;
      if (!taskStatus) continue;

      if (taskStatus === "completed") {
        await updateCommandRunForTask(run.commandRunId, "completed", null);
        continue;
      }

      if (taskStatus === "processing") {
        await updateCommandRunForTask(run.commandRunId, "processing", null);
        continue;
      }

      if (taskStatus === "failed") {
        if (run.attempts + 1 < MAX_RETRIES) {
          await incrementCommandRunAttempts(run.commandRunId, run.taskResult || "failed");
          await resetExecutorTask(run.executorTaskId);
          await updateCommandRunForTask(run.commandRunId, "queued", run.taskResult || "failed");
        } else {
          await updateCommandRunForTask(run.commandRunId, "failed", run.taskResult || "failed");
        }
        continue;
      }

      if (taskStatus === "pending") {
        await updateCommandRunForTask(run.commandRunId, "queued", null);
      }
    }
  } catch (error) {
    console.error("Webstore command sync failed", error);
  }
}

async function syncPurchaseStatuses() {
  try {
    const purchases = await getPurchasesNeedingFulfillment();

    for (const purchase of purchases) {
      db.query(
        "SELECT status FROM webstoreCommandRuns WHERE purchaseId = ?",
        [purchase.purchaseId],
        async (error, results) => {
          if (error) {
            console.error("Failed to load webstore command runs", error);
            return;
          }

          if (!results.length) {
            await updatePurchaseStatus(purchase.purchaseId, "fulfilled");
            return;
          }

          const statuses = results.map((row) => row.status);
          if (statuses.every((status) => status === "completed")) {
            await updatePurchaseStatus(purchase.purchaseId, "fulfilled");
          } else if (statuses.some((status) => status === "failed")) {
            await updatePurchaseStatus(purchase.purchaseId, "failed");
          }
        }
      );
    }
  } catch (error) {
    console.error("Webstore purchase sync failed", error);
  }
}

const task = cron.schedule("*/5 * * * *", async () => {
  await syncCommandRuns();
  await syncPurchaseStatuses();
});

task.start();
