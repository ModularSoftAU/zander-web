import { Command, RegisterBehavior } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import moment from "moment";
import fetch from "node-fetch";
import { getProfilePicture } from "../controllers/userController";

export class StatusCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName("status").setDescription("Get server status")
    );
  }

  async chatInputRun(interaction) {
    //
    // Grab server sync data
    //
    const fetchURL = `${process.env.siteAddress}/api/bridge/server/get`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });

    const apiData = await response.json();

    console.log(apiData);
  }
}
