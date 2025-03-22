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
    const shopApiURL = `${process.env.siteAddress}/api/shop/get?material=${encodeURIComponent(material)}`;    

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
              material ? ` for material: \`${material}\`` : ""
            }.`
          )
          .setColor(Colors.Orange);

        return interaction.editReply({
          embeds: [noItemsEmbed],
        });
      }

      // Construct an embed with shop items
      const itemsEmbed = new EmbedBuilder()
        .setTitle("🛍️ Shop Directory")
        .setDescription(
          `🔍 Here are the shop items${
            material ? ` for material: \`${material}\`` : ""
          }.`
        )
        .setColor(Colors.Blue);

      let outOfStockCount = 0;
      let fieldCount = 0;
      const embeds = [itemsEmbed];

      // Add fields for each shop item
      apiData.data.forEach((shop) => {
        if (shop.stock === 0) {
          outOfStockCount++;
          return;
        }

        const transactionType = shop.stock === -1 ? "💰 Buying" : "📦 Selling";
        const stockInfo = shop.stock !== -1 ? `**Stock:** ${shop.stock}\n` : "";

        // Set shop.amount to 1 if it is null
        const amount = shop.amount ?? 1;

        if (fieldCount >= 25) {
          const newEmbed = new EmbedBuilder()
            .setTitle("🛍️ Shop Directory (continued)")
            .setColor(Colors.Blue);
          embeds.push(newEmbed);
          fieldCount = 0;
        }

        embeds[embeds.length - 1].addFields([
          {
            name: `${transactionType} ${shop.itemData.displayName}`,
            value: `**Seller:** \`${shop.userData.username}\`\n**Amount:** ${amount}\n**Price:** $${shop.price}\n${stockInfo}**Location:** ${shop.x}, ${shop.y}, ${shop.z}`,
          },
        ]);
        fieldCount++;
      });

      if (outOfStockCount > 0) {
        embeds[embeds.length - 1].setFooter({
          text: `There were ${outOfStockCount} items that were out of stock and have been hidden from this search.`,
        });
      }

      interaction.editReply({
        embeds: embeds,
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
