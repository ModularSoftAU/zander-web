import { Command } from "@sapphire/framework";
import { EmbedBuilder, Colors } from "discord.js";
import { Webhook, MessageBuilder } from "discord-webhook-node";
import config from "../config.json" assert { type: "json" };

export class ResourcesCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("resources")
        .setDescription("Access or submit resources.")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("view")
            .setDescription("Provides a link to the resources page.")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("submit")
            .setDescription("Submit a resource for review.")
            .addStringOption((option) =>
              option
                .setName("title")
                .setDescription("The title of the resource.")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("description")
                .setDescription("A brief description of the resource.")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("url")
                .setDescription("The URL of the resource.")
                .setRequired(true)
            )
        )
    );
  }

  async chatInputRun(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "view") {
      // Handle "view" subcommand
      const resourcesPageLink = config.resourcesPageLink;
      const resourcesEmbed = new EmbedBuilder()
        .setTitle("Resources Page")
        .setDescription(
          `Check out the available resources: ${process.env.siteAddress}`
        )
        .setColor(Colors.Blue);

      return interaction.reply({ embeds: [resourcesEmbed], ephemeral: true });
    }

    if (subcommand === "submit") {
      // Handle "submit" subcommand: Gather inputs directly
      const title = interaction.options.getString("title");
      const description = interaction.options.getString("description");
      const url = interaction.options.getString("url");

      // Create an embed to send to the webhook
      const resourceSubmissionEmbed = new EmbedBuilder()
        .setTitle("New Resource Submitted")
        .addFields(
          { name: "Title", value: title, inline: false },
          { name: "Description", value: description, inline: false },
          { name: "URL", value: url, inline: false }
        )
        .setColor(Colors.Gold)
        .setFooter({ text: `Submitted by ${interaction.user.tag}` });

      const submissionConfirmedEmbed = new EmbedBuilder()
        .setTitle("Resource Submitted")
        .setDescription("Your resource has been submitted for review.")
        .setColor(Colors.Green);

      // Send the embed to the webhook
      const resourceReviewWebhook = new Webhook(
        config.discord.webhooks.resourcesReview
      );

      // Create the MessageBuilder (for simpler webhook handling)
      const resourceReviewEmbed = new MessageBuilder()
        .setTitle(`New Resource Submitted by \`${interaction.user.username}\``)
        .setDescription(
          `**Title:** ${title}\n**Description:** ${description}\n**URL:** ${url}`
        )
        .setColor(Colors.Gold);

      // Send the embed to the webhook
      await resourceReviewWebhook.send(resourceReviewEmbed);

      // Acknowledge the user
      return interaction.reply({
        embeds: [submissionConfirmedEmbed],
        ephemeral: true,
      });
    }
  }
}