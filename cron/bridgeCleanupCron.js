import cron from "node-cron";
import db from "../controllers/databaseController";

// Schedule the task to run once a day at 00:05 (5 minutes past midnight)
var bridgeCleanupTask = cron.schedule("5 0 * * *", () => {
  try {
    db.query(
      `DELETE FROM bridge WHERE bridgeDatetime <= NOW() - INTERVAL 3 DAY;`,
      function (error, results, fields) {
        if (error) {
          return console.log(`Error: ${error}`);
        }

        console.log(
          `Bridge cleanup complete. Rows affected: ${results.affectedRows}`
        );
      }
    );
  } catch (error) {
    console.log(`Error: ${error}`);
  }
});

bridgeCleanupTask.start();
