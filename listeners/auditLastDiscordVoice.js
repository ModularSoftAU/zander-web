import { Listener } from '@sapphire/framework';

export class VoiceStateUpdateListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'voiceStateUpdate'
    });
  }

  async run(oldState, newState) {
    console.log(newState);
  }
}