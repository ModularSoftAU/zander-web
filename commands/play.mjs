import { Command, RegisterBehavior } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";

export class PlayCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("play")
        .setDescription("Display all Network servers to play on.")
    );
  }

  async chatInputRun(interaction) {
    const fetchURL = `${process.env.siteAddress}/api/server/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    if (!apiData.data) {
      const noServersEmbed = new EmbedBuilder()
        .setTitle(`No Servers`)
        .setDescription(apiData.message)
        .setColor(Colors.Red);

      interaction.reply({
        embeds: [noServersEmbed],
        empheral: false,
      });
    } else {
      const embed = new EmbedBuilder()
        .setTitle(`Network Servers`)
        .setDescription(`Get started! Jump on and play with our community!`)
        .setColor(Colors.DarkGold);

      // Loop through the server data and add them to the embed
      apiData.data.forEach((server) => {
        embed.addFields({
          name: server.displayName,
          value: server.serverConnectionAddress,
          inline: true,
        });
      });

      interaction.reply({
        embeds: [embed],
        empheral: false,
      });
    }
  }
}
