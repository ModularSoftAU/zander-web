import { Command, RegisterBehavior } from '@sapphire/framework';
import pkg from 'discord.js';
const { EmbedBuilder } = pkg;

export class PolicyCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'policy',
      description: 'Display Network policy (Rules, Terms, Privacy, and Refund)',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      },
    });
  }

  async chatInputRun(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Network Policy')
      .setDescription('For user reference, here is a link to all Network policies.\nBy joining the Network and using our services you agree to all our policies.')
      .addFields(
        { name: 'Rules', value: `${process.env.siteAddress}/rules`, inline: false },
        { name: 'Terms Of Service', value: `${process.env.siteAddress}/terms`, inline: false },
        { name: 'Privacy Policy', value: `${process.env.siteAddress}/privacy`, inline: false },
        { name: 'Refund Policy', value: `${process.env.siteAddress}/refund`, inline: false }
      );

    const messageContent = {
      embeds: [embed],
      ephemeral: true,
    };

    interaction.reply(messageContent);
  }
}
