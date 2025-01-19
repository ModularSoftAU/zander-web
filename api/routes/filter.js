import { isFeatureEnabled, optional, required } from "../common.js";
import filter from "../../filter.json" assert { type: "json" };
import { UserGetter } from "../../controllers/userController.js";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { Colors } from "discord.js";

export default function filterApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/filter";

  app.post(baseEndpoint, async function (req, res) {
    if (!features.filter.phrase && !features.filter.link)
      return isFeatureEnabled(false, res, lang);

    const content = required(req.body, "content", res);
    const username = optional(req.body, "username", res);
    const discordId = optional(req.body, "discordId", res);

    try {
      let userData = null;

      // Fetch user data based on username or discordId
      if (username) {
        const usernameData = new UserGetter();
        const usernameGetData = await usernameData.byUsername(username);
        userData = usernameGetData;
      }

      if (discordId) {
        const discordUserData = new UserGetter();
        const discordUserGetData = await discordUserData.byDiscordId(discordId);
        userData = discordUserGetData;
      }

      // Log the received content to ensure it's correct
      console.log("Received content:", content);

      let urlDetected = false;
      let flaggedFor = [];

      // Scan for URLs using filter.links
      filter.links.forEach((link) => {
        const regex = new RegExp(link, "i");
        if (regex.test(content)) {
          console.log(`URL detected: ${link}`);
          urlDetected = true;
          flaggedFor.push("URL/Advertising");
        }
      });

      // Profanity check via external API
      const fetchURL = `https://vector.profanity.dev`;
      let profanityData = {};
      try {
        const response = await fetch(fetchURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        });

        profanityData = await response.json();
        console.log("Profanity Data:", profanityData);
      } catch (error) {
        console.log("Error calling profanity API:", error);
      }
      
      if (profanityData.isProfanity) {
        console.log("Profanity detected with score:", profanityData.score);
        flaggedFor.push(`Profanity (Score: ${profanityData.score})`);
      }

      // If any flags are detected, send the alert
      if (urlDetected || flaggedFor.length > 0) {
        try {
          const staffChannelHook = new Webhook(
            config.discord.webhooks.staffChannel
          );
          const embed = new MessageBuilder()
            .setTitle(`🟥 Filter Flagged`)
            .addField(
              "Detected User",
              `${userData?.username || "Unknown"}`,
              true
            )
            .addField("Flagged Issues", flaggedFor.join(", "), true)
            .addField("Content", `${content}`, false)
            .setColor(Colors.Red)
            .setTimestamp();

          console.log("Sending flagged content to staff channel...");
          await staffChannelHook.send(embed);

          return res.send({
            success: false,
            message: lang.filter.phraseCaught || "Content flagged.",
          });
        } catch (error) {
          console.log("Error sending to webhook:", error);
          return res.send({
            success: false,
            message: `${error}`,
          });
        }
      }

      // If no flags, content is clean
      return res.send({
        success: true,
        message: "Content is clean. No flags detected.",
      });
    } catch (error) {
      console.log("Error processing request:", error);
      return res.send({
        success: false,
        message: error,
      });
    }
  });
}
