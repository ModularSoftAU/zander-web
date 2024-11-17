import cron from "node-cron";
import { client } from "../controllers/discordController";
import config from "../config.json" assert { type: "json" };

var discordStatsUpdateTask = cron.schedule("* * * * *", async () => {
  try {
    // Fetch server sync data
    const fetchURL = `${process.env.siteAddress}/api/bridge/server/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });

    const apiData = await response.json();

    if (apiData.success && apiData.data && Array.isArray(apiData.data)) {
      let totalPlayers = 0;

      // Loop through each server status and calculate the total player count
      apiData.data.forEach((server) => {
        const serverInfo = JSON.parse(server.statusInfo); // Parse the statusInfo string
        serverInfo.forEach((status) => {
          totalPlayers += status.playerCount; // Add the player count from each server
        });
      });

      // Get the channel using the ID from config.discord.onlinePlayerChannel
      const channel = await client.channels.fetch(
        config.discord.onlinePlayerChannel
      );

      if (channel) {
        // Update the channel name with the total number of players
        await channel.setName(`Players Online: ${totalPlayers}`);
      } else {
        console.log("Channel not found");
      }
    } else {
      console.log("Invalid API response or data missing");
    }
  } catch (error) {
    console.log(`Error: ${error}`);
  }
});

discordStatsUpdateTask.start();
