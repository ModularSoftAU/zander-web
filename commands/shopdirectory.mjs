import { Command } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import features from "../features.json" assert { type: "json" };

export class ShopDirectoryCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("shopdirectory")
        .setDescription("List and browse shop items by material")
        .addStringOption((option) =>
          option
            .setName("material")
            .setDescription("The material to filter shop items by.")
            .setRequired(true)
        )
    );
  }

  async chatInputRun(interaction) {
    if (!features.shopdirectory) {
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

    // Defer the reply to prevent interaction expiration
    await interaction.deferReply();

    const material = interaction.options.getString("material") || "";
    const shopApiURL = `${
      process.env.siteAddress
    }/api/shop/get?material=${encodeURIComponent(material)}`;

    try {
      // Fetch shop data from the API
      const response = await fetch(shopApiURL, {
        headers: { "x-access-token": process.env.apiKey },
      });
      const apiData = await response.json();

      if (!apiData.success || !apiData.data.length) {
        const noItemsEmbed = new EmbedBuilder()
          .setTitle("No Shop Items Found")
          .setDescription(
            `No shop items were found${
              material ? ` for material: ${material}` : ""
            }.`
          )
          .setColor(Colors.Orange);

        return interaction.editReply({
          embeds: [noItemsEmbed],
        });
      }

      // Construct an embed with shop items
      const itemsEmbed = new EmbedBuilder()
        .setTitle("Shop Directory")
        .setDescription(
          `Here are the shop items${
            material ? ` for material: ${material}` : ""
          }.`
        )
        .setColor(Colors.Blue);

      // Add fields for each shop item
      apiData.data.forEach((shop) => {
        itemsEmbed.addFields([
          {
            name: `Item: ${shop.itemData.name || shop.item}`,
            value: `Seller: ${shop.userData.username}\nPrice: ${shop.price} coins\nLocation: ${shop.location}`,
          },
        ]);
      });

      interaction.editReply({
        embeds: [itemsEmbed],
      });
    } catch (error) {
      console.error("Error fetching shop items:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("Error")
        .setDescription(
          "There was an error fetching the shop items. Please try again later."
        )
        .setColor(Colors.Red);

      interaction.editReply({
        embeds: [errorEmbed],
      });
    }
  }
}
