import { Listener } from '@sapphire/framework';
import config from '../config.json' assert {type: "json"};
import { Colors, EmbedBuilder } from 'discord.js';

export class GuildMessageUpdateListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'messageUpdate'
    });
  }

  run(oldMessage, newMessage) {
    // Check if the author is a bot and stop if true.
    if (newMessage.author.bot) return;

    let adminLogChannel = oldMessage.guild.channels.cache.find(c => c.id === config.discord.channels.adminLog);
    if (!adminLogChannel) return;

    const embed = new EmbedBuilder()
      .setTitle('Message Edit')
      .setColor(Colors.Yellow)
      .setDescription(`Message edit from \`${oldMessage.author.username}\` in \`#${oldMessage.channel.name}\``)
      .addFields(
        { name: 'Channel', value: `\`$#{oldMessage.channel.name}\``, inline: false },
        { name: 'Old Message', value: `${oldMessage.content}`, inline: false },
        { name: 'Edited Message', value: `${newMessage.content}`, inline: false }
      );

    adminLogChannel.send({ embeds: [embed] });
  }
}
