import { Listener } from "@sapphire/framework";
import { updateAudit_lastDiscordMessage, updateAudit_lastDiscordVoice } from "../controllers/auditController";

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "voiceStateUpdate",
    });
  }

  async run(oldState, newState) {
    // Check if the user left a voice channel
    if (oldState.channel && !newState.channel) {
      // The user left a voice channel
      const user = oldState.member.user;

      //
      // Update user profile for auditing
      //
      try {
        updateAudit_lastDiscordVoice(new Date(), user.id);
      } catch (error) {
        return console.log(error);
      }
    }
  }
}
