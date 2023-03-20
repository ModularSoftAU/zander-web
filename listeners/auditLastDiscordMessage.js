import { Listener } from '@sapphire/framework';
import { setAuditLastDiscordMessage } from '../controllers/userController';

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'messageCreate'
    });
  }

  async run(message) {
    setAuditLastDiscordMessage(message.author.id)
  }
}