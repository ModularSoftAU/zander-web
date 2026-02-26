import { isFeatureEnabled, optional, required } from "../common.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const filter = require("../../filter.json");
import { UserGetter } from "../../controllers/userController.js";
import { MessageBuilder, Webhook } from "discord-webhook-node";
import { Colors } from "discord.js";
import { sendWebhookMessage } from "../../lib/discord/webhooks.mjs";

export default function filterApiRoute(
  app,
  client,
  config,
  db,
  features,
  lang
) {
  const baseEndpoint = "/api/filter";

  app.post(baseEndpoint, async function (req, res) {
    if (!features.filter.phrase && !features.filter.link) {
      if (!isFeatureEnabled(false, res, lang)) return;
    }

    const content = required(req.body, "content", res);
    if (res.sent) return;
    const username = optional(req.body, "username");
    const discordId = optional(req.body, "discordId");
    const discordUsername = optional(req.body, "discordUsername");

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

      // Check for words in the whitelist from filter.json
      const contentWords = content.split(/\s+/); // Split content into words
      const isWhitelisted = contentWords.some((word) =>
        filter.phrasesWhitelist.includes(word.toLowerCase())
      );

      if (isWhitelisted)
        res.send({
          success: true,
          message: "Content is clean. No flags detected.",
        }); return;

      let urlDetected = false;
      let flaggedFor = [];

      // Allow messages containing the guild ID unless they fail the profanity filter
      const containsGuildId = content.includes(config.discord.guildId);

      // Scan for URLs using filter.links if guild ID is not present
      if (!containsGuildId) {
        filter.links.forEach((link) => {
          const regex = new RegExp(link, "i");
          if (regex.test(content)) {
            urlDetected = true;
            flaggedFor.push("URL/Advertising");
          }
        });
      }

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
      } catch (error) {
        console.error("Error calling profanity API:", error);
      }

      if (profanityData.score >= 1)
        flaggedFor.push(`Profanity (Score: ${profanityData.score})`);

      // If any flags are detected, send the alert
      if (
        (urlDetected || flaggedFor.length > 0) &&
        !(containsGuildId && flaggedFor.length === 0)
      ) {
        try {
          const staffChannelHook = new Webhook(
            config.discord.webhooks.staffChannel
          );
          let detectedUser = "Unknown";
          if (userData?.username) {
            detectedUser = `${userData.username} (Verified)`;
          } else if (discordUsername) {
            detectedUser = `${discordUsername} (Unverified)`;
          } else if (discordId) {
            detectedUser = `<@${discordId}> (Unverified)`;
          }

          const embed = new MessageBuilder()
            .setTitle(`🔵 Filter Flagged`)
            .addField(
              "Detected User",
              detectedUser,
              true
            )
            .addField("Flagged Issues", flaggedFor.join(", "), true)
            .addField("Content", `${content}`, false)
            .setColor(Colors.Red)
            .setTimestamp();

          const webhookSent = await sendWebhookMessage(
            staffChannelHook,
            embed,
            { context: "api/filter" }
          );

          if (!webhookSent) {
            res.send({
              success: false,
              message: "Content flagged, but staff could not be notified.",
            }); return;
          }

          res.send({
            success: false,
            message: lang.filter.phraseCaught || "Content flagged.",
          }); return;
        } catch (error) {
          console.error("Error sending to webhook:", error);
          if (!res.sent) {
            res.send({
              success: false,
              message: `${error}`,
            }); return;
          }
        }
      }

      // If no flags, content is clean
      res.send({
        success: true,
        message: "Content is clean. No flags detected.",
      }); return;
    } catch (error) {
      console.error("Error processing request:", error);
      if (!res.sent) {
        res.status(500).send({
          success: false,
          message: error.message || "Internal Server Error",
        }); return;
      }
    }
  });
}
