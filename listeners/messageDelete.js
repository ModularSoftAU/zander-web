import { Listener } from '@sapphire/framework';
import config from '../config.json' assert { type: 'json' };
import { Colors, EmbedBuilder } from 'discord.js';

export class GuildMessageDeleteListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'messageDelete',
    });
  }

  async run(message) {
    // Check if the author of the deleted message is a bot and stop if true.
    if (message.author.bot) return;

    let adminLogChannel = message.guild.channels.cache.find(c => c.id === config.discord.channels.adminLog);
    if (!adminLogChannel) return;

    const embed = new EmbedBuilder()
      .setTitle('Message Delete')
      .setColor(Colors.Red)
      .setDescription(`Message deleted from \`${message.author.username}\` in \`#${message.channel.name}\``)
      .addFields(
        { name: 'Channel', value: `${message.channel.name}`, inline: false },
        { name: 'Deleted Message', value: `${message.content}`, inline: false }
      );

    adminLogChannel.send({ embeds: [embed] });
  }
}