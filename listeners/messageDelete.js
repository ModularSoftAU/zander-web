import { Listener } from "@sapphire/framework";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../config.json");
import { Colors, EmbedBuilder } from "discord.js";
import { MessageBuilder, Webhook } from "discord-webhook-node";

export class GuildMessageDeleteListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "messageDelete",
    });
  }

  async run(message) {
    // Check if the author of the deleted message is a bot and stop if true.
    if (message.author.bot) return;

    const adminLogHook = new Webhook(
      config.discord.webhooks.adminLog
    );

    const embed = new MessageBuilder()
      .setTitle("Message Delete")
      .setColor(Colors.Red)
      .setDescription(
        `Message deleted from \`${message.author.username}\` in \`#${message.channel.name}\``
      )
      .addField(
        "Deleted Message",
        `${message.content}`,
        false,
      );

    try {
      await adminLogHook.send(embed);
    } catch (error) {
      this.container.logger.error(
        `[CONSOLE] [DISCORD] Failed to publish delete log: ${error?.message || error}`
      );
    }
  }
}
