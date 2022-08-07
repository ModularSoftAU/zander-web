import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};
import features from '../features.json' assert {type: "json"};

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
    if (features.discord.commands.legoFlip) {
      if (Math.random() < 0.50) {
        const embed = new MessageEmbed()
        .setTitle(`Lego Flip!`)
        .setImage(`https://crafatar.com/avatars/2a881594693543c99c39ec31374d46fe?overlay`)
  
        interaction.reply({
          embeds: [embed]
        });
      } else {
        const embed = new MessageEmbed()
        .setTitle(`Lego Flip!`)
        .setImage(`https://crafatar.com/avatars/21a6469871f04578830a2ab0ac2f4d48?overlay`)
  
        interaction.reply({
          embeds: [embed]
        });        
      }
    } else {
      interaction.reply("This command has been disabled by the System Administrator.");
    }
  }
}