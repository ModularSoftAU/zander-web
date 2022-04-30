import { Listener } from '@sapphire/framework';
import config from '../config.json' assert {type: "json"};

export class GuildMessageDeleteListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: 'messageDelete'
    });
  }

  async run(message) {
    
    // If message delete wasn't inside a guild, return
    if (!message.guild) return;
    // If message delete was from a bot, return
    if (message.author.bot) return;

    // Grab the Admin Log channel by ID
    let logChannel = message.guild.channels.cache.get(config.discord.channels.adminLog)
    if (!logChannel) return;



    const entry = await message.guild.fetchAuditLogs({ type: "MESSAGE_DELETE" }).then(audit => audit.entries.first());

    console.log(entry);

    let user = ""
      if (entry.extra.channel.id === message.channel.id
        && (entry.target.id === message.author.id)
        && (entry.createdTimestamp > (Date.now() - 5000))
        && (entry.extra.count >= 1)) {
      user = entry.executor.username
    } else { 
      user = message.author.username
    }
    logChannel.send(`A message was deleted in ${message.channel.name} by ${user}`);

    var embed = new client.MessageEmbed()
      .setTitle(`${entry.targetType} ${entry.actionType} Entry`)
      // .setDescription(`Author: ${entry.executor.user.username} (${entry.executor.user.id})\nChannel: ${extra.channel.name}`)
    message.channel.send({ embed: embed });

  }
}