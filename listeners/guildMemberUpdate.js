import { Listener } from '@sapphire/framework';
import joinMessages from '../joinMessages.json' assert {type: "json"};
import config from '../config.json' assert {type: "json"};
import { MessageEmbed } from 'discord.js';

export class GuildMemberUpdateListener extends Listener {
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
    
    const oldRole = oldMember.roles.cache.has(config.discord.roles.verified);
    const newRole = newMember.roles.cache.has(config.discord.roles.verified);

    let welcomechannel = newMember.guild.channels.cache.find(c => c.id === config.discord.channels.welcomeChannel);
    if (!welcomechannel) return;

    // Grab random letters and numbers to get a HEX Colour.
    const randomColor = Math.floor(Math.random()*16777215).toString(16);

    // Select a random join message from joinMessages.json
    const randomJoinMessage = joinMessages[Math.floor(Math.random() * joinMessages.length)];

    if (!oldRole && newRole) {
      let embed = new MessageEmbed()
        .setTitle(randomJoinMessage.replace("%USERNAME%", newMember.user.username))
        .setColor(`#${randomColor}`)
      welcomechannel.send({embeds: [embed]});
    }
    return;
  }
}