import { Command } from "@sapphire/framework";
import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ActionRowBuilder, ChannelType } from "discord.js";
import { startTicketFlow } from "../lib/discord/ticketFlow.mjs";

export class SupportCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "ticket",
      description: "Create and manage support tickets.",
    });
  }

  registerApplicationCommands(registry) {
    const builder = new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((subcommand) =>
        subcommand.setName("create").setDescription("Open a new support ticket.")
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("submit").setDescription("Submit a support ticket.")
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("panel")
          .setDescription("Post a Create Ticket button in this channel.")
          .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Channel to place the Create Ticket button in.")
              .addChannelTypes(ChannelType.GuildText)
          )
      );

    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create" || subcommand === "submit") {
      return startTicketFlow(interaction);
    }

    if (subcommand === "panel") {
      const targetChannel =
        interaction.options.getChannel("channel") ?? interaction.channel;

      const createButton = new ButtonBuilder()
        .setCustomId("support_ticket_open")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary);

      await targetChannel.send({
        content: "Click below to create a private ticket with the support team.",
        components: [new ActionRowBuilder().addComponents(createButton)],
      });

      return interaction.reply({
        content: `Posted a Create Ticket button in ${targetChannel}.`,
        ephemeral: true,
      });
    }
  }
}
