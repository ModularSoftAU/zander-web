import { Command } from "@sapphire/framework";
import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType } from "discord.js";
import { ImgurClient } from "imgur";
import {
    getSupportCategories,
    getCategoryName,
    createSupportTicket,
    createSupportTicketMessage,
    getUserIdByDiscordId,
} from "../controllers/supportTicketController.js";

const imgurClient = new ImgurClient({
    clientId: process.env.IMGUR_CLIENT_ID,
    clientSecret: process.env.IMGUR_CLIENT_SECRET,
    refreshToken: process.env.IMGUR_REFRESH_TOKEN,
});

export class SupportCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "support",
      description: "Manage support tickets.",
    });
  }

  registerApplicationCommands(registry) {
    const builder = new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((subcommand) =>
        subcommand
            .setName("create")
            .setDescription("Create a new support ticket.")
            .addAttachmentOption((option) =>
                option
                    .setName("attachment")
                    .setDescription("An image to attach to the ticket.")
                    .setRequired(false)
            )
      );

    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const categories = await getSupportCategories();

      if (!categories.length) {
        return interaction.reply({
          content: "There are no support categories available at the moment.",
          ephemeral: true,
        });
      }

      const userId = await getUserIdByDiscordId(interaction.user.id);
      if (!userId) {
        return interaction.reply({
          content:
            "You need a registered web account linked to your Discord before creating a support ticket. Please sign up on the website and link your Discord account first.",
          ephemeral: true,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("support_category_select")
        .setPlaceholder("Select a category")
        .addOptions(
          categories.map((category) => ({
            label: category.name,
            value: category.categoryId.toString(),
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const reply = await interaction.reply({
        content: "Select a category to start a support ticket:",
        components: [row],
        ephemeral: true,
      });

      const filter = (i) => i.customId === "support_category_select" && i.user.id === interaction.user.id;

      let selection;
      try {
        selection = await reply.awaitMessageComponent({
          filter,
          time: 60000,
          componentType: ComponentType.StringSelect,
        });
      } catch (error) {
        return interaction.editReply({
          content: "Ticket creation timed out. Please run the command again when you're ready.",
          components: [],
        });
      }

      const categoryId = selection.values[0];

      const modal = new ModalBuilder()
        .setCustomId(`support_ticket_modal_${categoryId}`)
        .setTitle("Create Support Ticket");

      const titleInput = new TextInputBuilder()
        .setCustomId("title")
        .setLabel("Title")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const messageInput = new TextInputBuilder()
        .setCustomId("message")
        .setLabel("Message")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(messageInput)
      );

      await selection.showModal(modal);

      const modalFilter = (modalInteraction) =>
        modalInteraction.customId === `support_ticket_modal_${categoryId}` && modalInteraction.user.id === interaction.user.id;

      let modalInteraction;
      try {
        modalInteraction = await selection.awaitModalSubmit({ filter: modalFilter, time: 60000 });
      } catch (error) {
        return selection.followUp({ content: "Ticket creation timed out.", ephemeral: true });
      }

      const title = modalInteraction.fields.getTextInputValue("title");
      const message = modalInteraction.fields.getTextInputValue("message");
      const attachment = interaction.options.getAttachment("attachment");
      let attachmentUrl = null;

      if (attachment) {
        try {
          const response = await imgurClient.upload({
            image: attachment.url,
            type: "url",
          });
          attachmentUrl = response.data.link;
        } catch (error) {
          console.error(error);
        }
      }

      const ticketId = await createSupportTicket(interaction.client, userId, categoryId, title);
      await createSupportTicketMessage(interaction.client, ticketId, userId, message, attachmentUrl);

      const categoryName = await getCategoryName(categoryId);
      await this.sendNewTicketNotification(interaction.client, ticketId, title, categoryName, interaction.user.username);

      await modalInteraction.reply({
        content: "Your support ticket has been created successfully!",
        ephemeral: true,
      });
    }
  }

  async sendNewTicketNotification(client, ticketId, title, categoryName, username) {
    const channel = await client.channels.fetch(process.env.SUPPORT_NOTIFICATION_CHANNEL_ID);
    await channel.send(
        `A new support ticket has been created!\n\n**Ticket ID:** ${ticketId}\n**Title:** ${title}\n**Category:** ${categoryName}\n**User:** ${username}`
    );
  }
}
