import { Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class RulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'report',
      description: 'Display link to reporting players'
    });
  }

  async messageRun(message) {
    try {
      const embed = new MessageEmbed()
      .setTitle(`Report a Player`)
      .setDescription(`See a player breaking the rules, report them to Staff here: ${config.siteConfiguration.siteAddress}/report`)

      message.reply({
        embeds: [embed],
        empheral: true
      });                      
    } catch (error) {
      console.log(error);
      return
    }
  }
}