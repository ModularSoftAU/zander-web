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
  createUnlinkedUser,
  notifyTicketStatusChange,
  updateTicketStatus,
  deleteTicketChannel,
} from "../../controllers/supportTicketController.js";
import config from "../../config.json" assert { type: "json" };

const TICKET_SELECT_ID = "support_ticket_category_select";

export async function startTicketFlow(interaction, { parentCategoryId = null } = {}) {
  const resolvedParentCategoryId =
    parentCategoryId && parentCategoryId !== "undefined" && parentCategoryId !== ""
      ? parentCategoryId
      : null;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }
  const categories = await getSupportCategories();

  if (!categories.length) {
    return interaction.editReply({
      content: "Ticketing is unavailable right now because no categories are configured.",
      components: [],
    });
  }

  const userId = await getUserIdByDiscordId(interaction.user.id);
  if (!userId) {
    return interaction.editReply({
      content:
        "Please link your Discord account to a registered web account before opening a ticket.",
      components: [],
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(TICKET_SELECT_ID)
    .setPlaceholder("Choose a category")
    .addOptions(
      categories.map((category) => ({
        label: category.name,
        value: category.categoryId.toString(),
        description: category.description
          ? category.description.substring(0, 100)
          : undefined,
      }))
    );

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);
  const prompt = await interaction.editReply({
    content: "Select a category to start your ticket.",
    components: [selectRow],
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

  if (!modalInteraction.deferred && !modalInteraction.replied) {
    await modalInteraction.deferReply({ ephemeral: true });
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
    return modalInteraction.editReply({
      content: "We couldn't open your ticket right now. Please try again in a moment.",
    });
  }

  const { ticketId, channel } = ticketRecord;

  const siteBaseUrl =
    (config.siteConfiguration && config.siteConfiguration.siteUrl) ||
    process.env.SITE_URL ||
    "https://craftingforchrist.net";
  const normalizedSiteUrl = siteBaseUrl.endsWith("/")
    ? siteBaseUrl.slice(0, -1)
    : siteBaseUrl;
  const ticketUrl = `${normalizedSiteUrl}/support/ticket/${ticketId}`;

  await createSupportTicketMessage(
    interaction.client,
    ticketId,
    userId,
    description,
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

  const viewOnlineButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel("View Ticket Online")
    .setURL(ticketUrl);

  const message = await channel.send({
    content: `<@${interaction.user.id}> your ticket has been created.`,
    embeds: [ticketEmbed],
    components: [new ActionRowBuilder().addComponents(viewOnlineButton, closeButton)],
  });

  try {
    await message.pin();
  } catch (pinError) {
    console.error("Failed to pin ticket opener message", pinError);
  }

  return modalInteraction.editReply({
    content: `Ticket created in ${channel} with reference #${ticketId}.`,
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

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`support_ticket_close_confirm:${interaction.channel.id}`)
      .setLabel("Confirm Close")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`support_ticket_close_cancel:${interaction.channel.id}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content:
      "Are you sure you want to close this ticket? The channel will lock and delete 5 seconds after confirmation.",
    components: [confirmRow],
    ephemeral: true,
  });
}

export async function handleTicketCloseConfirmation(interaction) {
  const [, channelId] = interaction.customId.split(":");

  if (channelId && channelId !== interaction.channel.id) {
    return interaction.reply({
      content: "This close confirmation does not match this channel.",
      ephemeral: true,
    });
  }

  return performTicketClose(interaction);
}

export async function handleTicketCloseCancel(interaction) {
  const [, channelId] = interaction.customId.split(":");

  if (channelId && channelId !== interaction.channel.id) {
    return interaction.reply({
      content: "This close confirmation does not match this channel.",
      ephemeral: true,
    });
  }

  return interaction.update({
    content: "Ticket close cancelled.",
    components: [],
  });
}

async function performTicketClose(interaction) {
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
    await interaction.channel.send(
      `Ticket closed by ${interaction.user}. Deleting channel shortly...`
    );
  } catch (permissionError) {
    console.error("Failed to lock ticket channel", permissionError);
  }

  try {
    await updateTicketStatus(ticketDetails.ticketId, "closed");
    let actorUserId = await getUserIdByDiscordId(interaction.user.id);
    if (!actorUserId) {
      actorUserId = await createUnlinkedUser(interaction.user.id, interaction.user.username);
    }

    await notifyTicketStatusChange(ticketDetails.ticketId, "closed", {
      userId: actorUserId,
      name: interaction.user.username,
    });
  } catch (statusError) {
    console.error("Failed to update ticket status during close", statusError);
  }

  if (interaction.isMessageComponent()) {
    try {
      await interaction.update({ components: [closeRow] });
    } catch (updateError) {
      console.warn("Failed to update close button message", updateError);
    }
    try {
      await interaction.followUp({
        content: "Ticket locked. This channel will be removed shortly.",
        ephemeral: true,
      });
    } catch (followUpError) {
      console.warn("Failed to send close follow-up", followUpError);
    }
  } else {
    try {
      await interaction.reply({
        content: "Ticket locked. This channel will be removed shortly.",
        components: [closeRow],
        ephemeral: true,
      });
    } catch (replyError) {
      console.warn("Failed to send close reply", replyError);
    }
  }

  setTimeout(async () => {
    try {
      await deleteTicketChannel(interaction.client, ticketDetails.ticketId, "Ticket closed");
    } catch (deleteError) {
      console.error("Failed to delete closed ticket channel", deleteError);
    }
  }, 2500);
}
