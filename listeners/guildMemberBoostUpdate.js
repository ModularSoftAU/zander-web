import { Listener } from '@sapphire/framework';
import joinMessages from '../joinMessages.json' assert {type: "json"};
import config from '../config.json' assert {type: "json"};

export class GuildMemberBoostUpdateListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'guildMemberUpdate'
    });
  }

  run(oldMember, newMember) {
    const oldRole = oldMember.roles.cache.find(role => role.name === 'Nitro Booster');
    const newRole = newMember.roles.cache.find(role => role.name === 'Nitro Booster');

    if (!newMember.guild) return;
    // if (member.author.bot) return;

    let welcomechannel = newMember.guild.channels.cache.find(c => c.name === config.welcomechannel);
    if (!welcomechannel) return;

    if (!oldRole && newRole) {
      let embed = new Discord.MessageEmbed()
        .setTitle(`${newMember.user.username} has boosted the Server!  :tada:`)
        .setColor(`#f47fff`)
      welcomechannel.send(embed);
    } 
    return;
  }
}