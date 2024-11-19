import { isFeatureEnabled, optional, required } from "../common";
import filter from "../../filter.json" assert { type: "json" };
import { UserGetter } from "../../controllers/userController";
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

      let urlDetected = false;
      let flaggedFor = [];

      // Scan for URLs using filter.links
      filter.links.forEach((link) => {
        const regex = new RegExp(link, "i");
        if (regex.test(content)) {
          urlDetected = true;
          flaggedFor.push("URL/Advertising");
        }
      });

      // Check profanity with https://www.profanity.dev/#api
      const fetchURL = `https://vector.profanity.dev`;
      const response = await fetch(fetchURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      const profanityData = await response.json();

      // Only flag for profanity if the score is 1
      if (profanityData.isProfanity && profanityData.score > 1) {
        flaggedFor.push(`Profanity (Score: ${profanityData.score})`);
      }

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

          staffChannelHook.send(embed);

          return res.send({
            success: false,
            message: lang.filter.phraseCaught || "Content flagged.",
          });
        } catch (error) {
          return res.send({
            success: false,
            message: `${error}`,
          });
        }
      }

      return res.send({
        success: true,
        message: `Content Clean`,
      });
    } catch (error) {
      console.log(error);
      return res.send({
        success: false,
        message: error,
      });
    }
  });
}
