import { Listener } from "@sapphire/framework";
import { updateAudit_lastDiscordMessage } from "../controllers/auditController";

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "messageCreate",
    });
  }

  async run(message) {
    // Check if the author is a bot
    if (message.author.bot) return;

    // Check if the message content starts with the command prefix
    if (message.content.startsWith("/")) return;

    //
    // Update user profile for auditing
    //
    try {
      updateAudit_lastDiscordMessage(new Date(), message.author.id);
    } catch (error) {
      return console.log(error);
    }
  }
}
