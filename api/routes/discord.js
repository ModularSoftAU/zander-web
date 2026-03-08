import {
  updateAudit_lastMinecraftLogin,
  updateAudit_lastMinecraftMessage,
} from "../../controllers/auditController.js";
import { Webhook } from "discord-webhook-node";
import { sendWebhookMessage } from "../../lib/discord/webhooks.mjs";
import { isFeatureEnabled, required } from "../common.js";
import { checkRateLimit } from "../../lib/rateLimiter.mjs";

export default function discordApiRoute(
  app,
  client,
  config,
  db,
  features,
  lang
) {
  const baseEndpoint = "/api/discord";

  app.post(baseEndpoint + "/switch", async function (req, res) {
    if (!isFeatureEnabled(features.discord, res, lang)) return;
    const username = required(req.body, "username", res);
    if (res.sent) return;
    const server = required(req.body, "server", res);
    if (res.sent) return;

    try {
      const networkChatLogHook = new Webhook(
        config.discord.webhooks.networkChatLog
      );

      const webhookSent = await sendWebhookMessage(
        networkChatLogHook,
        `:twisted_rightwards_arrows: | \`${username}\` switched to \`${server}\``,
        { context: "api/discord#switch" }
      );

      if (!webhookSent) {
        return res.send({
          success: false,
          message: "Unable to deliver Discord notification right now.",
        });
      }

      return res.send({
        success: true,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/chat", async function (req, res) {
    if (!isFeatureEnabled(features.discord, res, lang)) return;
    const username = required(req.body, "username", res);
    if (res.sent) return;
    const server = required(req.body, "server", res);
    if (res.sent) return;
    const content = required(req.body, "content", res);
    if (res.sent) return;

    try {
      await updateAudit_lastMinecraftMessage(new Date(), username);
    } catch (error) {
      console.error(error);
      // We can continue even if auditing fails, or handle it as an error.
      // For consistency, let's treat it as a failure if it's critical.
    }

    try {
      const networkChatLogHook = new Webhook(
        config.discord.webhooks.networkChatLog
      );

      const webhookSent = await sendWebhookMessage(
        networkChatLogHook,
        `**${server}** | \`${username}\` :: ${content}`,
        { context: "api/discord#chat" }
      );

      if (!webhookSent) {
        return res.send({
          success: false,
          message: "Unable to deliver Discord notification right now.",
        });
      }

      return res.send({
        success: true,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/join", async function (req, res) {
    if (!isFeatureEnabled(features.discord, res, lang)) return;
    const username = required(req.body, "username", res);
    if (res.sent) return;

    try {
      const networkChatLogHook = new Webhook(
        config.discord.webhooks.networkChatLog
      );

      const webhookSent = await sendWebhookMessage(
        networkChatLogHook,
        `:ballot_box_with_check: | \`${username}\` has joined the Network.`,
        { context: "api/discord#join" }
      );

      if (!webhookSent) {
        return res.send({
          success: false,
          message: "Unable to deliver Discord notification right now.",
        });
      }

      return res.send({ success: true });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/leave", async function (req, res) {
    if (!checkRateLimit(req, res, { windowMs: 60_000, max: 60 })) return;
    if (!isFeatureEnabled(features.discord, res, lang)) return;
    const username = required(req.body, "username", res);
    if (res.sent) return;

    try {
      await updateAudit_lastMinecraftLogin(new Date(), username);
    } catch (error) {
      console.error(error);
    }

    try {
      const networkChatLogHook = new Webhook(
        config.discord.webhooks.networkChatLog
      );

      const webhookSent = await sendWebhookMessage(
        networkChatLogHook,
        `:negative_squared_cross_mark: | \`${username}\` has left the Network.`,
        { context: "api/discord#leave" }
      );

      if (!webhookSent) {
        return res.send({
          success: false,
          message: "Unable to deliver Discord notification right now.",
        });
      }

      return res.send({
        success: true,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/spy/command", async function (req, res) {
    if (!checkRateLimit(req, res, { windowMs: 60_000, max: 120 })) return;
    if (!isFeatureEnabled(features.discord, res, lang)) return;
    const username = required(req.body, "username", res);
    if (res.sent) return;
    const command = required(req.body, "command", res);
    if (res.sent) return;
    const server = required(req.body, "server", res);
    if (res.sent) return;

    try {
      const networkChatLogHook = new Webhook(
        config.discord.webhooks.networkChatLog
      );

      const webhookSent = await sendWebhookMessage(
        networkChatLogHook,
        `:floppy_disk: | **${server}** | \`${username}\` executed command \`${command}\``,
        { context: "api/discord#spy-command" }
      );

      if (!webhookSent) {
        return res.send({
          success: false,
          message: "Unable to deliver Discord notification right now.",
        });
      }

      return res.send({
        success: true,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/spy/directMessage", async function (req, res) {
    if (!isFeatureEnabled(features.discord, res, lang)) return;
    const usernameFrom = required(req.body, "usernameFrom", res);
    if (res.sent) return;
    const usernameTo = required(req.body, "usernameTo", res);
    if (res.sent) return;
    const directMessage = required(req.body, "directMessage", res);
    if (res.sent) return;
    const server = required(req.body, "server", res);
    if (res.sent) return;

    try {
      const networkChatLogHook = new Webhook(
        config.discord.webhooks.networkChatLog
      );

      const webhookSent = await sendWebhookMessage(
        networkChatLogHook,
        `:speaking_head: | **${server}** | \`${usernameFrom}\` => \`${usernameTo}\`: \`${directMessage}\``,
        { context: "api/discord#spy-directMessage" }
      );

      if (!webhookSent) {
        return res.send({
          success: false,
          message: "Unable to deliver Discord notification right now.",
        });
      }

      return res.send({
        success: true,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });
}
