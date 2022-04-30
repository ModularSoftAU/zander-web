import { Listener } from '@sapphire/framework';

export class GuildMessageListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'messageCreate'
    });
  }

  run(message) {
    const msgcontent = message.content;
    if (msgcontent.toLowerCase().includes("hello there")) {
      message.channel.send('General Kenobi');
      return;
    };
  }
}