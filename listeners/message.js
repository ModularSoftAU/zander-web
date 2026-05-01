import { Listener } from "@sapphire/framework";
import { updateAudit_lastDiscordMessage } from "../controllers/auditController.js";
import { logDiscordActivity } from "../controllers/applicationEligibilityController.js";

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "messageCreate",
    });
  }

  async run(message) {
    // Ignore bots and slash commands
    if (message.author.bot) return;
    if (message.content.startsWith("/")) return;

    try {
      updateAudit_lastDiscordMessage(new Date(), message.author.id);
    } catch (error) {
      console.error("message listener: failed to update audit log", error);
    }

    // Log Discord activity for eligibility checks (non-blocking, best-effort)
    logDiscordActivity({
      discordUserId: message.author.id,
      channelId: message.channelId || null,
      activityType: "message",
    }).catch(() => {});
  }
}
