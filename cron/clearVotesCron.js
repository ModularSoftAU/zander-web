import cron from "node-cron";
import db from "../controllers/databaseController.js";

var clearVotesTask = cron.schedule("0 0 1 * *", () => {
  try {
    db.query(
      `TRUNCATE votes;`,
      [],
      function (error, results, fields) {
        if (error) {
          return console.log(`${error}`);
        }

        return console.log(`Votes table cleared successfully.`);
      }
    );
  } catch (error) {
    return console.log(`${error}`);
  }
});

clearVotesTask.start();
