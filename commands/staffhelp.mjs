import { Command, RegisterBehavior } from '@sapphire/framework';
import { Colors, EmbedBuilder } from 'discord.js';
import config from '../config.json' assert {type: "json"};

export class StaffHelpCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('staffhelp')
        .setDescription('Sends a message to our Staff for help or assistance.')
        .addStringOption((option) =>
          option //
            .setName('query')
            .setDescription('Question to ask in the poll.')
            .setRequired(true)
        )
    );
  }

  async chatInputRun(interaction) {
    const userQuery = interaction.options.getString('query');

    const staffAssistanceEmbed = new EmbedBuilder()
      .setTitle(`Staff Assistance Requested by \`${interaction.user.username}\``)
      .setDescription(`**Request:** ${userQuery}`)
      .setColor(Colors.Gold);
    
    const staffAssistanceConfirmed = new EmbedBuilder()
      .setTitle(`Staff Assistance Requested`)
      .setDescription(`Assistance request has been sent.`)
      .setColor(Colors.Green);

    const guild = interaction.guild;
    const channel = guild.channels.cache.get(config.discord.channels.staffChannel);

    channel.send({
      embeds: [staffAssistanceEmbed]
    });

    interaction.reply({
      embeds: [staffAssistanceConfirmed],
      ephemeral: true
    });
  }
}