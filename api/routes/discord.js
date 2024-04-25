import { updateAudit_lastMinecraftLogin, updateAudit_lastMinecraftMessage } from "../../controllers/auditController";
import { Webhook } from "discord-webhook-node";
import { isFeatureEnabled, required } from "../common";

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
    isFeatureEnabled(features.discord, res, lang);
    const username = required(req.body, "username", res);
    const server = required(req.body, "server", res);

    try {
      const networkChatLogHook = new Webhook(
        config.discord.webhooks.networkChatLog
      );

      networkChatLogHook.send(
        `:twisted_rightwards_arrows: | \`${username}\` switched to \`${server}\``
      );

      return res.send({
        success: true,
      });
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/chat", async function (req, res) {
    isFeatureEnabled(features.discord, res, lang);
    const username = required(req.body, "username", res);
    const server = required(req.body, "server", res);
    const content = required(req.body, "content", res);

    //
    // Update user profile for auditing
    //
    try {
      updateAudit_lastMinecraftMessage(new Date(), username);
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    //
    // Send Discord Message to Log
    //
    try {
      const guild = client.guilds.cache.get(config.discord.guildId);
      const channel = guild.channels.cache.get(
        config.discord.channels.networkChatLog
      );

      channel.send(`**${server}** | \`${username}\` :: ${content}`);

      return res.send({
        success: true,
      });
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  app.post(baseEndpoint + "/join", async function (req, res) {
    isFeatureEnabled(features.discord, res, lang);
    const username = required(req.body, "username", res);

    //
    // Send Discord Message to Log
    //
    try {
      const guild = client.guilds.cache.get(config.discord.guildId);
      const channel = guild.channels.cache.get(
        config.discord.channels.networkChatLog
      );

      channel.send(
        `:ballot_box_with_check: | \`${username}\` has joined the Network.`
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  app.post(baseEndpoint + "/leave", async function (req, res) {
    isFeatureEnabled(features.discord, res, lang);
    const username = required(req.body, "username", res);

    //
    // Update user profile for auditing
    //
    try {
      updateAudit_lastMinecraftLogin(new Date(), username);
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    //
    // Send Discord Message to Log
    //
    try {
      const guild = client.guilds.cache.get(config.discord.guildId);
      const channel = guild.channels.cache.get(
        config.discord.channels.networkChatLog
      );

      channel.send(
        `:negative_squared_cross_mark: | \`${username}\` has left the Network.`
      );

      res.send({
        success: true,
      });
    } catch (error) {
      res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}
