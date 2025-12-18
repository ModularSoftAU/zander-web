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
import config from "../config.json" assert { type: "json" };
import { startTicketFlow } from "../lib/discord/ticketFlow.mjs";
import {
  addTicketGroupParticipant,
  addTicketUserParticipant,
  applyTicketParticipantPermissions,
  createUnlinkedUser,
  getCategoryPermissions,
  getTicketDetailsByChannel,
  getUserIdByDiscordId,
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
          .setName("add")
          .setDescription("Add a user or role to the current ticket.")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Discord user to add to the ticket")
          )
          .addRoleOption((option) =>
            option
              .setName("role")
              .setDescription("Discord role to grant access to the ticket")
          )
      );

    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create" || subcommand === "submit") {
      return startTicketFlow(interaction);
    }

    if (subcommand === "add") {
      const userOption = interaction.options.getUser("user");
      const roleOption = interaction.options.getRole("role");

      if (!userOption && !roleOption) {
        return interaction.reply({
          content: "Provide a user or role to add to this ticket.",
          ephemeral: true,
        });
      }

      const ticketDetails = await getTicketDetailsByChannel(interaction.channel.id);

      if (!ticketDetails) {
        return interaction.reply({
          content: "This channel is not linked to a ticket.",
          ephemeral: true,
        });
      }

      const categoryStaffRoles = await getCategoryPermissions(ticketDetails.categoryId);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasPermission =
        member.permissions.has(PermissionFlagsBits.ManageChannels) ||
        member.roles.cache.some((role) => categoryStaffRoles.includes(role.id));

      if (!hasPermission) {
        return interaction.reply({
          content: "You need support staff permissions to update ticket access.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const additions = [];

      if (userOption) {
        let targetUserId = await getUserIdByDiscordId(userOption.id);

        if (!targetUserId) {
          try {
            targetUserId = await createUnlinkedUser(userOption.id, userOption.username);
          } catch (userCreateError) {
            console.error("ticket add: failed to create placeholder user", userCreateError);
          }
        }

        if (targetUserId) {
          try {
            await addTicketUserParticipant(ticketDetails.ticketId, { userId: targetUserId });
            additions.push(`Added user ${userOption.tag}`);
          } catch (userAddError) {
            console.error("ticket add: failed to add user participant", userAddError);
            additions.push(`Failed to add ${userOption.tag}`);
          }
        } else {
          additions.push(`Unable to add ${userOption.tag} (no linked account).`);
        }
      }

      if (roleOption) {
        try {
          await addTicketGroupParticipant(ticketDetails.ticketId, {
            id: roleOption.id,
            name: roleOption.name,
            rankSlug: null,
            badgeColor: null,
            textColor: null,
          });
          additions.push(`Added role ${roleOption.name}`);
        } catch (roleAddError) {
          console.error("ticket add: failed to add role participant", roleAddError);
          additions.push(`Failed to add role ${roleOption.name}`);
        }
      }

      try {
        await applyTicketParticipantPermissions(interaction.client, ticketDetails.ticketId);
      } catch (permissionError) {
        console.error("ticket add: failed to apply participant permissions", permissionError);
        additions.push("Warning: could not refresh channel permissions.");
      }

      return interaction.editReply({
        content: additions.join("\n") || "No changes applied.",
      });
    }

    if (subcommand === "panel") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({
          content: "You need Manage Channels permission to post a ticket panel.",
          ephemeral: true,
        });
      }

      const configuredPanelChannelId =
        config.discord?.supportPanelChannelId ?? process.env.SUPPORT_CHANNEL_ID;
      const configuredTicketCategoryId =
        config.discord?.supportTicketCategoryId ?? process.env.SUPPORT_CATEGORY_ID;

      const suppliedChannel = interaction.options.getChannel("channel");
      const suppliedCategory = interaction.options.getChannel("ticket_category");

      let targetChannel = suppliedChannel ?? null;

      if (!targetChannel && configuredPanelChannelId) {
        try {
          targetChannel = await interaction.client.channels.fetch(
            configuredPanelChannelId
          );
        } catch (error) {
          console.warn("ticket panel config channel fetch failed", error);
        }
      }

      if (!targetChannel) {
        targetChannel = interaction.channel;
      }

      let ticketCategory = suppliedCategory ?? null;

      if (!ticketCategory && configuredTicketCategoryId) {
        try {
          ticketCategory = await interaction.client.channels.fetch(
            configuredTicketCategoryId
          );
        } catch (error) {
          console.warn("ticket panel config category fetch failed", error);
        }
      }

      const parentCategoryId = ticketCategory?.id ?? configuredTicketCategoryId ?? "";

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
  }
}
