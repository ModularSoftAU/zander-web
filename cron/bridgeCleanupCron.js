import cron from "node-cron";
import db from "../controllers/databaseController.js";

// Schedule the task to run once a day at 00:05 (5 minutes past midnight)
var bridgeCleanupTask = cron.schedule("5 0 * * *", () => {
  try {
    db.query(
      `DELETE FROM executorTasks WHERE status IN ('completed', 'failed') AND updatedAt <= NOW() - INTERVAL 7 DAY;`,
      function (error, results) {
        if (error) {
          return console.log(`Bridge cleanup error: ${error}`);
        }

        console.log(
          `Bridge cleanup removed ${results.affectedRows} completed tasks.`
        );
      }
    );

    db.query(
      `DELETE FROM player_command_queue WHERE status IN ('completed', 'failed') AND updated_at <= NOW() - INTERVAL 7 DAY;`,
      function (error, results) {
        if (error) {
          return console.log(`Command bridge cleanup error: ${error}`);
        }

        if (results.affectedRows > 0) {
          console.log(
            `Command bridge cleanup removed ${results.affectedRows} completed/failed command(s).`
          );
        }
      }
    );

    db.query(
      `UPDATE executorTasks SET status = 'pending', executedBy = NULL, result = NULL, processedAt = NULL, updatedAt = NOW() WHERE status = 'processing' AND updatedAt <= NOW() - INTERVAL 1 HOUR;`,
      function (error, results) {
        if (error) {
          return console.log(`Bridge reset error: ${error}`);
        }

        if (results.affectedRows > 0) {
          console.log(
            `Bridge reset ${results.affectedRows} stale processing task(s).`
          );
        }
      }
    );
  } catch (error) {
    console.log(`Error: ${error}`);
  }
});

bridgeCleanupTask.start();
