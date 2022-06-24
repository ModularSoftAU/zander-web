import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class RulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'rules',
      description: 'Display link to the Network Rules',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      }      
    });
  }

  async chatInputRun(interaction) {
    const embed = new MessageEmbed()
      .setTitle(`Network Rules`)
      .setDescription(`Please ensure you follow and abide by the rules which you can read here: ${config.siteConfiguration.siteAddress}/rules`)

      interaction.reply({
        embeds: [embed],
        empheral: true
      });
  }
}