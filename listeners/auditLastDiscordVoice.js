import { Listener } from '@sapphire/framework';
import { setAuditLastDiscordVoice } from '../controllers/userController';

export class VoiceStateUpdateListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'voiceStateUpdate'
    });
  }

  async run(oldState, newState) {
    setAuditLastDiscordVoice(oldState.id);
  }
}
