import cron from "node-cron";
import { client } from "../controllers/discordController.js";
import config from "../config.json" with { type: "json" };

var discordStatsUpdateTask = cron.schedule("*/5 * * * *", async () => {
  console.log("Cron task is running...");

  try {
    // Fetch server sync data
    const fetchURL = `${process.env.siteAddress}/api/bridge/server/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error("Error in discordStatsUpdateCron: Expected JSON response, but received:", responseText);
        throw new Error("Did not receive JSON response from API. Check siteAddress configuration.");
    }

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
        console.log(`Updated channel name to: Players Online: ${totalPlayers}`);
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
