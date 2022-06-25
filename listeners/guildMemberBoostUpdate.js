import { Listener } from '@sapphire/framework';
import config from '../config.json' assert {type: "json"};
import { MessageEmbed } from 'discord.js';

export class GuildMemberBoostUpdateListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'guildMemberUpdate'
    });
  }

  run(oldMember, newMember) {
    if (!newMember.guild) return;
    if (newMember.user.bot) return;

    const oldStatus = oldMember.premiumSince;
    const newStatus = newMember.premiumSince;

    let welcomechannel = newMember.guild.channels.cache.find(c => c.id === config.discord.channels.welcomeChannel);
    if (!welcomechannel) return;

    if (!oldStatus && newStatus) {
      let embed = new MessageEmbed()
        .setTitle(`${newMember.user.username} has boosted the Server!  :tada:`)
        .setColor(`#f47fff`)
      welcomechannel.send({embeds: [embed]});
    }
    return;
  }
}