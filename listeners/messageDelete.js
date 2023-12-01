import { Listener } from "@sapphire/framework";
import config from "../config.json" assert { type: "json" };
import { Colors, EmbedBuilder } from "discord.js";
import { MessageBuilder } from "discord-webhook-node";

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
      .addFields({
        name: "Deleted Message",
        value: `${message.content}`,
        inline: false,
      });

    adminLogHook.send(embed);
  }
}
