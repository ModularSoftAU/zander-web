import { Command, RegisterBehavior } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

export class RulesCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName('rules').setDescription('Display link to the Network Rules')
    );
  }

  async chatInputRun(interaction) {
    const embed = new EmbedBuilder()
      .setTitle(`Network Rules`)
      .setDescription(`Please ensure you follow and abide by the rules which you can read here: ${process.env.siteAddress}/rules`)
      .setColor(Colors.DarkGold)

      interaction.reply({
        embeds: [embed],
        empheral: true
      });
  }
}