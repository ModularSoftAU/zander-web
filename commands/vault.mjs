import { Command, RegisterBehavior } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import features from "../features.json" assert { type: "json" };

export class RanksCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("vault")
        .setDescription("Display link to view link to the map vault.")
    );
  }

  async chatInputRun(interaction) {
    if (!features.vault) {
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

    const embed = new EmbedBuilder()
      .setTitle(`Vault`)
      .setDescription(
        `Explore the Vault to discover and download our previous maps and explore the worlds and builds of our community: ${process.env.siteAddress}/vault`
      )
      .setColor(Colors.DarkGold);

    interaction.reply({
      embeds: [embed],
      empheral: false,
    });
  }
}
