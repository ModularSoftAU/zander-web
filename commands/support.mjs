import { Command } from "@sapphire/framework";
import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { ImgurClient } from "imgur";
import {
    getSupportCategories,
    getCategoryName,
    createSupportTicket,
    createSupportTicketMessage,
    getUserIdByDiscordId,
    createUnlinkedUser,
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

      await interaction.reply({
        content: "Please select a category for your support ticket:",
        components: [row],
        ephemeral: true,
      });

      const filter = (i) => i.customId === "support_category_select" && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on("collect", async (i) => {
        const categoryId = i.values[0];

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

        const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
        const secondActionRow = new ActionRowBuilder().addComponents(messageInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await i.showModal(modal);

        const modalFilter = (modalInteraction) => modalInteraction.customId === `support_ticket_modal_${categoryId}` && modalInteraction.user.id === interaction.user.id;
        try {
            const modalInteraction = await i.awaitModalSubmit({ filter: modalFilter, time: 60000 });

            const title = modalInteraction.fields.getTextInputValue("title");
            const message = modalInteraction.fields.getTextInputValue("message");
            const attachment = interaction.options.getAttachment("attachment");
            let attachmentUrl = null;

            if (attachment) {
              const response = await imgurClient.upload({
                image: attachment.url,
                type: "url",
              });
              attachmentUrl = response.data.link;
            }

            let userId = await getUserIdByDiscordId(interaction.user.id);
            let unlinked = false;

            if (!userId) {
              userId = await createUnlinkedUser(interaction.user.id, interaction.user.username);
              unlinked = true;
            }

            const ticketId = await createSupportTicket(interaction.client, userId, categoryId, title);
            await createSupportTicketMessage(interaction.client, ticketId, userId, message, attachmentUrl);

            const categoryName = await getCategoryName(categoryId);
            await this.sendNewTicketNotification(interaction.client, ticketId, title, categoryName, interaction.user.username);

            let replyMessage = "Your support ticket has been created successfully!";
            if (unlinked) {
              replyMessage += "\n\nTo view and manage your ticket on our website, please register an account and link your Discord.";
            }

            await modalInteraction.reply({
              content: replyMessage,
              ephemeral: true,
            });
        } catch (err) {
            if (err.code === 'InteractionCollectorError') {
                await i.followUp({ content: 'You did not respond in time.', ephemeral: true });
            } else {
                console.error(err);
                await i.followUp({ content: 'Ticket creation failed.', ephemeral: true });
            }
        }
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
