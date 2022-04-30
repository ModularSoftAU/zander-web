import { Listener } from '@sapphire/framework';
import joinMessages from '../joinMessages.json' assert {type: "json"};
import config from '../config.json' assert {type: "json"};

export class GuildMemberUpdateListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'guildMemberUpdate'
    });
  }

  run(client, oldMember, newMember) {
    console.log(oldMember);
    console.log(newMember);


    if (!newMember.guild) return;
    // if (member.author.bot) return;

    const oldRole = oldMember.roles.cache.find(role => role.name === 'Verified');
    const newRole = newMember.roles.cache.find(role => role.name === 'Verified');

    console.log(oldRole);

    let welcomechannel = newMember.guild.channels.cache.find(c => c.name === config.welcomechannel);
    if (!welcomechannel) return;

    // Grab random letters and numbers to get a HEX Colour.
    const randomColor = Math.floor(Math.random()*16777215).toString(16);

    // Select a random join message from joinMessages.json
    const randomJoinMessage = joinMessages[Math.floor(Math.random() * joinMessages.length)];

    if (!oldRole && newRole) {
      let embed = new Discord.MessageEmbed()
      .setTitle(randomJoinMessage.replace("%USERNAME%", newMember.user.username))
      .setColor(`#${randomColor}`)
      welcomechannel.send(embed);
    } 
    return;
  }
}