import { Command, RegisterBehavior } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import config from "../config.json" assert { type: "json" };
import { MessageBuilder, Webhook } from "discord-webhook-node";

export class StaffHelpCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("staffhelp")
        .setDescription("Sends a message to our Staff for help or assistance.")
        .addStringOption((option) =>
          option //
            .setName("query")
            .setDescription("What you need help with?")
            .setRequired(true)
        )
    );
  }

  async chatInputRun(interaction) {
    const userQuery = interaction.options.getString("query");

    const staffAssistanceEmbed = new MessageBuilder ()
      .setTitle(
        `Staff Assistance Requested by \`${interaction.user.username}\``
      )
      .setDescription(`**Request:** ${userQuery}`)
      .setColor(Colors.Gold);

    const staffAssistanceConfirmed = new EmbedBuilder()
      .setTitle(`Staff Assistance Requested`)
      .setDescription(`Assistance request has been sent.`)
      .setColor(Colors.Green);

    const staffChannelHook = new Webhook(
      config.discord.webhooks.staffChannel
    );
    staffChannelHook.send(staffAssistanceEmbed);

    interaction.reply({
      embeds: [staffAssistanceConfirmed],
      ephemeral: true,
    });
  }
}
