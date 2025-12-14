import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  createSupportTicket,
  createSupportTicketMessage,
  getCategoryName,
  getCategoryPermissions,
  getSupportCategories,
  getTicketDetailsByChannel,
  getUserIdByDiscordId,
} from "../../controllers/supportTicketController.js";

const TICKET_SELECT_ID = "support_ticket_category_select";

export async function startTicketFlow(interaction, { parentCategoryId = null } = {}) {
  const resolvedParentCategoryId = parentCategoryId || null;
  const categories = await getSupportCategories();

  if (!categories.length) {
    return interaction.reply({
      content: "Ticketing is unavailable right now because no categories are configured.",
      ephemeral: true,
    });
  }

  const userId = await getUserIdByDiscordId(interaction.user.id);
  if (!userId) {
    return interaction.reply({
      content:
        "Please link your Discord account to a registered web account before opening a ticket.",
      ephemeral: true,
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(TICKET_SELECT_ID)
    .setPlaceholder("Choose a category")
    .addOptions(
      categories.map((category) => ({
        label: category.name,
        value: category.categoryId.toString(),
      }))
    );

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);
  const prompt = await interaction.reply({
    content: "Select a category to start your ticket.",
    components: [selectRow],
    ephemeral: true,
    fetchReply: true,
  });

  let selection;
  try {
    selection = await prompt.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 60000,
      filter: (componentInteraction) =>
        componentInteraction.customId === TICKET_SELECT_ID &&
        componentInteraction.user.id === interaction.user.id,
    });
  } catch {
    return interaction.editReply({
      content: "Ticket creation timed out. Please try again when you're ready.",
      components: [],
    });
  }

  const categoryId = Number.parseInt(selection.values[0], 10);
  const modal = new ModalBuilder()
    .setCustomId(`support_ticket_modal_${categoryId}`)
    .setTitle("Create Ticket");

  const subjectInput = new TextInputBuilder()
    .setCustomId("subject")
    .setLabel("Subject")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("Description")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(subjectInput),
    new ActionRowBuilder().addComponents(descriptionInput)
  );

  await selection.showModal(modal);

  let modalInteraction;
  try {
    modalInteraction = await selection.awaitModalSubmit({
      filter: (modalEvent) =>
        modalEvent.customId === `support_ticket_modal_${categoryId}` &&
        modalEvent.user.id === interaction.user.id,
      time: 60000,
    });
  } catch {
    return selection.followUp({ content: "Ticket creation timed out.", ephemeral: true });
  }

  const subject = modalInteraction.fields.getTextInputValue("subject");
  const description = modalInteraction.fields.getTextInputValue("description");
  const staffRoleIds = await getCategoryPermissions(categoryId);
  const categoryName = await getCategoryName(categoryId);

  let ticketRecord;
  try {
    ticketRecord = await createSupportTicket(
      interaction.client,
      userId,
      categoryId,
      subject,
      {
        discordUserId: interaction.user.id,
        staffRoleIds,
        parentCategoryId: resolvedParentCategoryId,
      }
    );
  } catch (error) {
    console.error("Failed to create ticket", error);
    return modalInteraction.reply({
      content: "We couldn't open your ticket right now. Please try again in a moment.",
      ephemeral: true,
    });
  }

  const { ticketId, channel } = ticketRecord;

  await createSupportTicketMessage(
    interaction.client,
    ticketId,
    userId,
    description,
    null,
    "discord"
  );

  const ticketEmbed = new EmbedBuilder()
    .setTitle(`Ticket #${ticketId}: ${subject}`)
    .setDescription(description)
    .addFields(
      { name: "Opened by", value: `${interaction.user.tag} (<@${interaction.user.id}>)` },
      { name: "Category", value: categoryName }
    )
    .setTimestamp(new Date())
    .setColor(0x2b6cb0);

  const closeButton = new ButtonBuilder()
    .setCustomId("support_ticket_close")
    .setLabel("Close Ticket")
    .setStyle(ButtonStyle.Danger);

  const message = await channel.send({
    content: `<@${interaction.user.id}> your ticket has been created.`,
    embeds: [ticketEmbed],
    components: [new ActionRowBuilder().addComponents(closeButton)],
  });

  try {
    await message.pin();
  } catch (pinError) {
    console.error("Failed to pin ticket opener message", pinError);
  }

  return modalInteraction.reply({
    content: `Ticket created in ${channel} with reference #${ticketId}.`,
    ephemeral: true,
  });
}

export async function handleTicketClose(interaction) {
  const ticketDetails = await getTicketDetailsByChannel(interaction.channel.id);

  if (!ticketDetails) {
    return interaction.reply({
      content: "This channel is not linked to a ticket.",
      ephemeral: true,
    });
  }

  const categoryStaffRoles = await getCategoryPermissions(ticketDetails.categoryId);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const isStaff =
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.roles.cache.some((role) => categoryStaffRoles.includes(role.id));

  if (!isStaff) {
    return interaction.reply({
      content: "You need support staff permissions to close this ticket.",
      ephemeral: true,
    });
  }

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("support_ticket_closed")
      .setLabel("Ticket Closed")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  try {
    if (ticketDetails.discordId) {
      await interaction.channel.permissionOverwrites.edit(ticketDetails.discordId, {
        SendMessages: false,
        ViewChannel: true,
      });
    }
    await interaction.channel.send(`Ticket closed by ${interaction.user}.`);
    await interaction.channel.edit({ name: `${interaction.channel.name}-closed` });
  } catch (permissionError) {
    console.error("Failed to lock ticket channel", permissionError);
  }

  if (interaction.isMessageComponent()) {
    await interaction.update({ components: [closeRow] });
    await interaction.followUp({
      content: "Ticket locked. You may delete the channel if no longer needed.",
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: "Ticket locked. You may delete the channel if no longer needed.",
      components: [closeRow],
      ephemeral: true,
    });
  }
}
