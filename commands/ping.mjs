import { Command } from '@sapphire/framework';

export class PingCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'pingpong',
      // aliases: ['pong'],
      description: 'ping pong'
    });
  }

  async messageRun(message) {
    const msg = await message.channel.send('Ping?');

    const content = `Pong from JavaScript! Bot Latency ${Math.round(this.container.client.ws.ping)}ms. API Latency ${
      msg.createdTimestamp - message.createdTimestamp
    }ms.`;

    return msg.edit(content);
  }
}