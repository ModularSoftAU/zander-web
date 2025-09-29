import { Listener } from "@sapphire/framework";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../config.json");
import { Colors, EmbedBuilder } from "discord.js";
import { MessageBuilder, Webhook } from "discord-webhook-node";

export class GuildMessageUpdateListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "messageUpdate",
    });
  }

  async run(oldMessage, newMessage) {
    // Check if the author is a bot and stop if true.
    if (newMessage.author.bot) return;

    const adminLogHook = new Webhook(
      config.discord.webhooks.adminLog
    );

    const embed = new MessageBuilder()
      .setTitle("Message Edit")
      .setColor(Colors.Yellow)
      .setDescription(
        `Message edit from \`${oldMessage.author.username}\` in \`#${oldMessage.channel.name}\``
      )
      .addField(
        "Old Message",
        `${oldMessage.content}`,
        false
      )
      .addField(
        "Edited Message",
        `${newMessage.content}`,
        false,
      );

    try {
      await adminLogHook.send(embed);
    } catch (error) {
      this.container.logger.error(
        `[CONSOLE] [DISCORD] Failed to publish edit log: ${error?.message || error}`
      );
    }
  }
}
