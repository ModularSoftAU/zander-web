import cron from "node-cron";
import db from "../controllers/databaseController";
import { Colors } from "discord.js";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import config from "../config.json" assert { type: "json" };
import moment from "moment";

var cakeDayUserCheckTask = cron.schedule("0 7 * * *", () => {
  try {
    db.query(
      `SELECT * FROM users WHERE DATE_FORMAT(joined, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d') AND YEAR(joined) != YEAR(CURDATE()) AND account_registered IS NOT NULL;`,
      function (error, results, fields) {
        if (error) {
          return console.log(`Error: ${error}`);
        }

        console.log(results);

        const welcomeHook = new Webhook(config.discord.webhooks.welcome);

        results.forEach((user) => {
          const joinDate = moment(user.joined); // Parse the join date
          const years = moment().diff(joinDate, "years"); // Calculate the difference in years

          let embed = new MessageBuilder()
            .setTitle(`🎂 Happy cake day to ${user.username}! :tada:`)
            .setDescription(
              `Celebrating ${years} year(s) with ${config.siteConfiguration.siteName}`
            )
            .setColor(Colors.Blurple)
            .setFooter(
              `To get your cake day mention, make sure you are a member on our website.`
            );

          welcomeHook.send(embed);
        });
      }
    );
  } catch (error) {
    console.log(`Error: ${error}`);
  }
});

cakeDayUserCheckTask.start();