import { Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class PolicyCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'policy',
      description: 'Display Network policy (Rules, Terms, Privacy and Refund)'
    });
  }

  async messageRun(message) {
    try {
      const embed = new MessageEmbed()
      .setTitle(`Network Policy`)
      .setDescription(`For user reference, here is a link to all Network polices.\nBy joining the Network and using our services you agree to all our polices.`)

      .addField(`Rules`, `${config.siteConfiguration.siteAddress}/rules`)
      .addField(`Terms Of Service`, `${config.siteConfiguration.siteAddress}/terms`)
      .addField(`Privacy Policy`, `${config.siteConfiguration.siteAddress}/privacy`)
      .addField(`Refund Policy`, `${config.siteConfiguration.siteAddress}/refund`)

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