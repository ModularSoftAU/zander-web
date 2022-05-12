import { Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class WebsiteCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'website',
      description: 'Display Network Website'
    });
  }

  async messageRun(message) {
    try {
      const embed = new MessageEmbed()
      .setTitle(`Network Website`)
      .setDescription(`For more info and to get involved with the community, jump on our website ${config.siteConfiguration.siteAddress}`)

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