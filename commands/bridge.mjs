import { Command } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import {
  getUserPermissions,
  UserGetter,
} from "../controllers/userController.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const features = require("../features.json");

export class BridgeCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("bridge")
        .setDescription("Manage and view bridge status.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("status")
            .setDescription("View the current bridge executor queue.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Queue a command for a specific server slug.")
            .addStringOption((option) =>
              option
                .setName("command")
                .setDescription("The command for the bridge.")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("targetedserver")
                .setDescription("The slug of the server to target (e.g. proxy, survival).")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("clear")
            .setDescription("Clear all commands on the Bridge.")
        )
    );
  }

  async chatInputRun(interaction) {
    if (!features.bridge) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("Feature Disabled")
        .setDescription(
          `This feature has been disabled by your System Administrator.`
        )
        .setColor(Colors.Red);

      return interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }

    // Resolve the user to a User ID in the database
    const userData = new UserGetter();
    const userGetData = await userData.byDiscordId(interaction.user.id);

    const userPermissions = await getUserPermissions(userGetData);
    const hasPermission = userPermissions.includes("zander.web.bridge");

    if (!hasPermission) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("No Permission")
        .setDescription(`You do not have access to use this command.`)
        .setColor(Colors.Red);

      return interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }

    // Handle the different subcommands
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "status") {
      try {
        const [pendingResponse, processingResponse] = await Promise.all([
          fetch(`${process.env.siteAddress}/api/bridge/processor/get?status=pending&limit=50`, {
            headers: { "x-access-token": process.env.apiKey },
          }),
          fetch(`${process.env.siteAddress}/api/bridge/processor/get?status=processing&limit=50`, {
            headers: { "x-access-token": process.env.apiKey },
          }),
        ]);

        const [pendingData, processingData] = await Promise.all([
          pendingResponse.json(),
          processingResponse.json(),
        ]);

        if (!pendingData.success || !processingData.success) {
          const errorEmbed = new EmbedBuilder()
            .setTitle("Bridge Status Error")
            .setDescription("There was an error fetching the bridge status queue.")
            .setColor(Colors.Red);

          return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const pendingTasks = pendingData.data || [];
        const processingTasks = processingData.data || [];
        const combined = [...pendingTasks, ...processingTasks];

        if (!combined.length) {
          const noBridgesEmbed = new EmbedBuilder()
            .setTitle("Bridge Status")
            .setDescription("There are currently no executor tasks queued.")
            .setColor(Colors.Blurple);

          return interaction.reply({
            embeds: [noBridgesEmbed],
            ephemeral: true,
          });
        }

        const statusEmbed = new EmbedBuilder()
          .setTitle("Bridge Status")
          .setDescription(
            `Pending: **${pendingTasks.length}** | Processing: **${processingTasks.length}**`
          )
          .setColor(Colors.Blurple);

        combined.slice(0, 10).forEach((task) => {
          statusEmbed.addFields({
            name: `Task #${task.executorTaskId} (${task.slug})`,
            value: `Command: \`${task.command}\`\nStatus: **${task.status}**\nQueued: ${new Date(
              task.createdAt
            ).toLocaleString()}${
              task.routineSlug ? `\nRoutine: ${task.routineSlug}` : ""
            }`,
            inline: false,
          });
        });

        if (combined.length > 10) {
          statusEmbed.setFooter({
            text: `Showing 10 of ${combined.length} queued tasks`,
          });
        }

        return interaction.reply({ embeds: [statusEmbed], ephemeral: true });
      } catch (error) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("Bridge Status Error")
          .setDescription("There was an error fetching the bridge status queue.")
          .setColor(Colors.Red);

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }

    if (subcommand === "add") {
      const command = interaction.options.getString("command");
      const targetedServer = interaction.options.getString("targetedserver");

      try {
        const response = await fetch(
          `${process.env.siteAddress}/api/bridge/processor/command/add`,
          {
            method: "POST",
            headers: {
              "x-access-token": process.env.apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              command: command,
              slug: targetedServer,
            }),
          }
        );

        const apiData = await response.json();

        if (!apiData.success) {
          const errorEmbed = new EmbedBuilder()
            .setTitle("Bridge Add Error")
            .setDescription(`Failed to add the bridge: ${apiData.message}`)
            .setColor(Colors.Red);

          return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const successEmbed = new EmbedBuilder()
          .setTitle("Bridge Command Added")
          .setDescription(
            `Queued command for \`${targetedServer}\`: \`${command}\``
          )
          .setColor(Colors.Green);

        return interaction.reply({ embeds: [successEmbed], ephemeral: true });
      } catch (error) {
        console.log(error);

        const errorEmbed = new EmbedBuilder()
          .setTitle("Bridge Add Error")
          .setDescription("There was an error adding the bridge.")
          .setColor(Colors.Red);

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }

    if (subcommand === "clear") {
      try {
        // Create the confirmation embed
        const confirmationEmbed = new EmbedBuilder()
          .setTitle("Are You Sure?")
          .setDescription(
            "Are you sure you want to clear the bridge? This action cannot be undone."
          )
          .setColor(Colors.Orange);

        // Create the "Yes" and "No" buttons
        const yesButton = new ButtonBuilder()
          .setCustomId("clear_bridge_yes")
          .setLabel("Yes")
          .setStyle(ButtonStyle.Danger);

        const noButton = new ButtonBuilder()
          .setCustomId("clear_bridge_no")
          .setLabel("No")
          .setStyle(ButtonStyle.Secondary);

        // Create an action row to hold the buttons
        const actionRow = new ActionRowBuilder().addComponents(
          yesButton,
          noButton
        );

        // Send the confirmation message with buttons
        await interaction.reply({
          embeds: [confirmationEmbed],
          components: [actionRow],
          ephemeral: true,
        });

        // Create a collector to handle button interactions
        const filter = (i) =>
          i.user.id === interaction.user.id &&
          (i.customId === "clear_bridge_yes" ||
            i.customId === "clear_bridge_no");

        const collector = interaction.channel.createMessageComponentCollector({
          filter,
          time: 15000, // 15 seconds
        });

        collector.on("collect", async (i) => {
          if (i.customId === "clear_bridge_yes") {
            // User confirmed, clear the bridge
            try {
              const response = await fetch(
                `${process.env.siteAddress}/api/bridge/processor/clear`,
                {
                  method: "POST",
                  headers: {
                    "x-access-token": process.env.apiKey,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({}),
                }
              );

              const apiData = await response.json();

              if (!apiData.success) {
                const errorEmbed = new EmbedBuilder()
                  .setTitle("Bridge Clear Error")
                  .setDescription("Failed to clear the bridge.")
                  .setColor(Colors.Red);

                return i.update({
                  embeds: [errorEmbed],
                  components: [],
                  ephemeral: true,
                });
              }

              const successEmbed = new EmbedBuilder()
                .setTitle("Bridge Cleared")
                .setDescription(apiData.message || "The executor queue has been cleared.")
                .setColor(Colors.Green);

              return i.update({
                embeds: [successEmbed],
                components: [],
                ephemeral: true,
              });
            } catch (error) {
              console.log(error);
              
              const errorEmbed = new EmbedBuilder()
                .setTitle("Bridge Clear Error")
                .setDescription("There was an error clearing the bridge.")
                .setColor(Colors.Red);

              return i.update({
                embeds: [errorEmbed],
                components: [],
                ephemeral: true,
              });
            }
          } else if (i.customId === "clear_bridge_no") {
            // User canceled, respond accordingly
            const canceledEmbed = new EmbedBuilder()
              .setTitle("Action Canceled")
              .setDescription("The bridge clear action has been canceled.")
              .setColor(Colors.Grey);

            return i.update({
              embeds: [canceledEmbed],
              components: [],
              ephemeral: true,
            });
          }
        });

        collector.on("end", (collected) => {
          if (collected.size === 0) {
            // No interaction collected within time limit
            interaction.editReply({
              content: "No response received. Action has been canceled.",
              components: [],
            });
          }
        });
      } catch (error) {
        console.log(error);
        
        const errorEmbed = new EmbedBuilder()
          .setTitle("Bridge Clear Error")
          .setDescription(
            "There was an error initiating the bridge clear process."
          )
          .setColor(Colors.Red);

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
}
