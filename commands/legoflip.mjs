import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class LegoFlipCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'legoflip',
      description: 'A simple lego flip!',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      },
    });
  }

  async chatInputRun(interaction) {

    if (Math.random() < 0.50) {
      const embed = new MessageEmbed()
      .setTitle(`Lego Flip!`)
      .setImage(`https://i.imgur.com/vb4TlPx.png`)

      interaction.reply({
        embeds: [embed]
      });
    } else {
      const embed = new MessageEmbed()
      .setTitle(`Lego Flip!`)
      .setImage(`https://i.imgur.com/s1qzAYM.png`)

      interaction.reply({
        embeds: [embed]
      });
    }
  }
}