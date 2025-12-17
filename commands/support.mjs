import { Command } from "@sapphire/framework";
import {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { startTicketFlow } from "../lib/discord/ticketFlow.mjs";
import {
  getSupportPanelConfig,
  saveSupportPanelConfig,
} from "../controllers/supportTicketController.js";

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
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Channel to place the Create Ticket button in.")
              .addChannelTypes(ChannelType.GuildText)
          )
          .addChannelOption((option) =>
            option
              .setName("ticket_category")
              .setDescription("Discord category where ticket channels will be created.")
              .addChannelTypes(ChannelType.GuildCategory)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("config")
          .setDescription(
            "Set the default channel and category used for ticket panels and ticket channels."
          )
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Default channel where the ticket panel message will be posted.")
              .addChannelTypes(ChannelType.GuildText)
          )
          .addChannelOption((option) =>
            option
              .setName("ticket_category")
              .setDescription(
                "Default Discord category where ticket channels will be created."
              )
              .addChannelTypes(ChannelType.GuildCategory)
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
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({
          content: "You need Manage Channels permission to post a ticket panel.",
          ephemeral: true,
        });
      }

      const panelConfig = await getSupportPanelConfig();

      const suppliedChannel = interaction.options.getChannel("channel");
      const suppliedCategory = interaction.options.getChannel("ticket_category");

      let targetChannel = suppliedChannel ?? null;

      if (!targetChannel && panelConfig.panelChannelId) {
        try {
          targetChannel = await interaction.client.channels.fetch(
            panelConfig.panelChannelId
          );
        } catch (error) {
          console.warn("ticket panel config channel fetch failed", error);
        }
      }

      if (!targetChannel) {
        targetChannel = interaction.channel;
      }

      let ticketCategory = suppliedCategory ?? null;

      if (!ticketCategory && panelConfig.parentCategoryId) {
        try {
          ticketCategory = await interaction.client.channels.fetch(
            panelConfig.parentCategoryId
          );
        } catch (error) {
          console.warn("ticket panel config category fetch failed", error);
        }
      }

      const parentCategoryId = ticketCategory?.id ?? process.env.SUPPORT_CATEGORY_ID ?? "";

      const createButton = new ButtonBuilder()
        .setCustomId(
          parentCategoryId ? `support_ticket_open:${parentCategoryId}` : "support_ticket_open"
        )
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary);

      const infoEmbed = new EmbedBuilder()
        .setTitle("Need help? Open a ticket")
        .setDescription(
          [
            "Submit your issue privately to the support team.",
            "\n**How it works:**",
            "• Click **Create Ticket** to choose a category.",
            "• Fill out the subject and description in the modal form.",
            "• A private channel will be created for you and our staff.",
            "• Use the Close button in the ticket to wrap up when you're done.",
          ].join("\n")
        )
        .setColor(0x2b6cb0);

      await targetChannel.send({
        embeds: [infoEmbed],
        components: [new ActionRowBuilder().addComponents(createButton)],
      });

      return interaction.reply({
        content: `Posted a Create Ticket panel in ${targetChannel} using the ${
          ticketCategory ? `\`${ticketCategory.name}\`` : "default"
        } ticket category.`,
        ephemeral: true,
      });
    }

    if (subcommand === "config") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({
          content: "You need Manage Channels permission to configure the ticket panel.",
          ephemeral: true,
        });
      }

      const targetChannel = interaction.options.getChannel("channel");
      const ticketCategory = interaction.options.getChannel("ticket_category");

      await saveSupportPanelConfig({
        panelChannelId: targetChannel?.id ?? null,
        parentCategoryId: ticketCategory?.id ?? null,
      });

      return interaction.reply({
        content: `Saved ticket panel defaults: ${
          targetChannel ? `channel set to ${targetChannel}` : "no default channel set"
        } and ${
          ticketCategory
            ? `ticket category set to \`${ticketCategory.name}\``
            : "no default ticket category set"
        }.`,
        ephemeral: true,
      });
    }
  }
}
