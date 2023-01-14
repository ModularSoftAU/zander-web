import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class ReportCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'report',
      description: 'Display link to reporting players',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      }
    });
  }

  async chatInputRun(interaction) {
    const embed = new MessageEmbed()
    .setTitle(`Report a Player`)
    .setDescription(`See a player breaking the rules, report them to Staff here: ${process.env.siteAddress}/report`)

    interaction.reply({
      embeds: [embed],
      empheral: true
    });
  }

}