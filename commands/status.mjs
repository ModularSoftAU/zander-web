import { Command } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";

export class StatusCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName("status").setDescription("Get server status")
    );
  }

  // Utility function to format Discord countdown timestamp
  getCDStamp(timestamp = Date.now()) {
    return `<t:${Math.round(timestamp / 1000)}:R>`; // Convert ms to seconds
  }

  async chatInputRun(interaction) {
    try {
      // Fetch server sync data
      const fetchURL = `${process.env.siteAddress}/api/bridge/server/get`;
      const response = await fetch(fetchURL, {
        headers: { "x-access-token": process.env.apiKey },
      });

      const apiData = await response.json();

      // Check if the response is successful
      if (!apiData.success) {
        return interaction.reply("Failed to retrieve server status.");
      }

      const data = apiData.data;
      const embed = new EmbedBuilder()
        .setTitle("Server Status")
        .setColor(Colors.Blue)
        .setTimestamp();

      // Start building the description
      let description = "Here is the current server status:\n";

      // Loop through each server status info
      data.forEach((serverStatus) => {
        const statusInfo = JSON.parse(serverStatus.statusInfo);
        statusInfo.forEach((server) => {
          // Capitalize the first letter of the server name
          const capitalizedServerName =
            server.serverName.charAt(0).toUpperCase() +
            server.serverName.slice(1);

          embed.addFields({
            name: capitalizedServerName,
            value: `**Count:** ${server.playerCount}\n**Players:** ${
              server.playerNames.length > 0
                ? server.playerNames.join(", ")
                : "No players online"
            }`,
            inline: true,
          });
        });

        // Add the "Last updated" info into the description
        const lastUpdatedTimestamp = Math.round(
          new Date(serverStatus.lastUpdated).getTime() / 1000
        ); // Convert to Unix timestamp (seconds)
        description += `*Last updated:* <t:${lastUpdatedTimestamp}:R>\n\n`; // Add relative time to description
      });

      // Set the description for the embed
      embed.setDescription(description);

      // Send the embed message
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error fetching server status:", error);
      interaction.reply("There was an error retrieving the server status.");
    }
  }
}
