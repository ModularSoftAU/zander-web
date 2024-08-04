import cron from "node-cron";
import db from "../controllers/databaseController";

var userCodeExpiryTask = cron.schedule("5 * * * *", () => {
  try {
    db.query(
      `DELETE FROM userVerifyLink WHERE codeExpiry <= NOW() - INTERVAL 5 MINUTE;`,
      [new Date()],
      function (error, results, fields) {
        if (error) {
          return console.log(`${error}`);
        }

        return console.log(`userVerifyLink deletion complete.`);
      }
    );
  } catch (error) {
    return console.log(`${error}`);
  }
});

userCodeExpiryTask.start();
