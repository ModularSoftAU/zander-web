import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class PolicyCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'policy',
      description: 'Display Network policy (Rules, Terms, Privacy and Refund)',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      },
    });
  }

  async chatInputRun(interaction) {
    const embed = new MessageEmbed()
      .setTitle(`Network Policy`)
      .setDescription(`For user reference, here is a link to all Network polices.\nBy joining the Network and using our services you agree to all our polices.`)

      .addField(`Rules`, `${config.siteConfiguration.siteAddress}/rules`)
      .addField(`Terms Of Service`, `${config.siteConfiguration.siteAddress}/terms`)
      .addField(`Privacy Policy`, `${config.siteConfiguration.siteAddress}/privacy`)
      .addField(`Refund Policy`, `${config.siteConfiguration.siteAddress}/refund`)

      interaction.reply({
        embeds: [embed],
        empheral: true
      });
  }
}