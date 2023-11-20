import { Listener } from "@sapphire/framework";
import features from "../features.json" assert { type: "json" };

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "messageCreate",
    });
  }

  run(message) {
    if (message.author.isbot) return;

    if (features.discord.events.generalKenobi) {
      if (message.content.toLowerCase().includes("hello there")) {
        message.channel.send("General Kenobi");
        return;
      }
    }
  }
}
