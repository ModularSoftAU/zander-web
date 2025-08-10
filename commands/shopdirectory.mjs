import { Command } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, EmbedBuilder } from "discord.js";
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

      // Filter out shops with no stock (stock is 0)
      const originalShopCount = apiData.data.length;
      const inStockShops = apiData.data.filter(shop => shop.stock !== 0);
      const outOfStockCount = originalShopCount - inStockShops.length;

      if (!inStockShops.length) {
        const noItemsEmbed = new EmbedBuilder()
          .setTitle("No Shop Items Found")
          .setDescription(
            `No shop items were found${
              material ? ` for material: \`${material}\`` : ""
            }.`
          )
          .setColor(Colors.Orange);

        if (outOfStockCount > 0) {
          noItemsEmbed.setFooter({ text: `${outOfStockCount} shop(s) not shown (out of stock).` });
        }

        return interaction.editReply({
          embeds: [noItemsEmbed],
        });
      }

      // Create pages of shops
      const shopPages = [];
      for (let i = 0; i < inStockShops.length; i += 25) {
        shopPages.push(inStockShops.slice(i, i + 25));
      }

      let currentPageIndex = 0;

      const createEmbed = (pageIndex) => {
        const page = shopPages[pageIndex];
        const embed = new EmbedBuilder()
          .setTitle("🛍️ Shop Directory")
          .setDescription(
            `🔍 Here are the shop items${
              material ? ` for material: \`${material}\`` : ""
            }.`
          )
          .setColor(Colors.Blue);

        page.forEach((shop) => {
          const transactionType = shop.stock === -1 ? "💰 Buying" : "📦 Selling";
          const stockInfo = shop.stock !== -1 ? `**Stock:** ${shop.stock}\n` : "";

          embed.addFields([
            {
              name: `Item: ${shop.itemData.displayName}`,
              value: `**Seller:** \`${shop.userData.username}\`\n**Amount:** ${shop.amount}\n**Price:** $${shop.price}\n${stockInfo}**Type:** ${transactionType}\n**Location:** ${shop.x}, ${shop.y}, ${shop.z}`,
            },
          ]);
        });

        let footerText = `Page ${pageIndex + 1} of ${shopPages.length}`;
        if (outOfStockCount > 0) {
          footerText += ` | ${outOfStockCount} shop(s) not shown (out of stock).`;
        }
        embed.setFooter({ text: footerText });

        return embed;
      };

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(shopPages.length === 1)
        );

      const reply = await interaction.editReply({
        embeds: [createEmbed(currentPageIndex)],
        components: [row]
      });

      const collector = reply.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'prev_page') {
          currentPageIndex--;
        } else if (i.customId === 'next_page') {
          currentPageIndex++;
        }

        row.components[0].setDisabled(currentPageIndex === 0);
        row.components[1].setDisabled(currentPageIndex === shopPages.length - 1);

        await i.update({
          embeds: [createEmbed(currentPageIndex)],
          components: [row]
        });
      });

      collector.on('end', async () => {
        row.components.forEach(component => component.setDisabled(true));
        await reply.edit({ components: [row] }).catch(() => {});
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
