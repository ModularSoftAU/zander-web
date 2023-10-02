import { Command, RegisterBehavior } from '@sapphire/framework';
import { EmbedBuilder, MessageEmbed } from 'discord.js';

export class WebsiteCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'website',
      description: 'Display Network Website',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      }
    });
  }

  async chatInputRun(interaction) {
    const embed = new MessageEmbed()
      .setTitle(`Network Website`)
      .setDescription(`For more info and to get involved with the community, jump on our website ${process.env.siteAddress}`)

      interaction.reply({
        embeds: [embed],
        empheral: true
      });
  }
}