import { Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class RulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'rules',
      description: 'Display Network Rules'
    });
  }

  async messageRun(message) {
    try {
      const embed = new MessageEmbed()
      .setTitle(`Network Rules`)
      .setDescription(`Please ensure you follow and abide by the rules which you can read here: ${config.siteConfiguration.siteAddress}/rules`)

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