import { Command, RegisterBehavior } from '@sapphire/framework';
import { Colors, EmbedBuilder } from 'discord.js';

export class PollCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName('poll').setDescription('Ask everyone a question or something to vote on!')
      .addStringOption((option) =>
        option //
          .setName('question')
          .setDescription('Question to ask in the poll.')
          .setRequired(true)
      )
    );
  }

  async chatInputRun(interaction) {
    const pollQuestion = interaction.options.getString('question');

    const embed = new EmbedBuilder()
      .setTitle(`Poll by \`${interaction.user.username}\``)
      .setDescription(`${pollQuestion}`)
      .setFooter({ text: 'Vote using the reactions below to have your say!' })
      .setColor(Colors.Blue)

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    await message.react('⬆️');
    await message.react('⬇️');
  }
}