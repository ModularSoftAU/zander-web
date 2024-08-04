import { Command, RegisterBehavior } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import moment from "moment";
import fetch from "node-fetch";

export class ProfileCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("profile")
        .setDescription("Display profile for yourself or another player.")
        .addStringOption((option) =>
          option //
            .setName("username")
            .setDescription("Username of the profile to fetch.")
            .setRequired(true)
        )
    );
  }

  async chatInputRun(interaction) {
    const username = interaction.options.getString("username");

    try {
      
    } catch (error) {
      
    }

    //
    // Grab user profile data
    //
    const fetchURL = `${process.env.siteAddress}/api/user/profile/get?username=${username}`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });

    const apiData = await response.json();

    if (!apiData.success) {
      const noProfileEmbed = new EmbedBuilder()
        .setTitle(`Could not fetch profile.`)
        .setDescription(`User either does not exist or there was an issue fetching profile.`)
        .setColor(Colors.Red);

      interaction.reply({
        embeds: [noProfileEmbed],
        empheral: false,
      });
    } else {
      console.log(apiData.data);

      let isLinked = apiData.data.profileData.discordId;

      const embed = new EmbedBuilder()
        if (isLinked) {
          embed.setTitle(`${apiData.data.profileData.username}'s Profile ✅`);
        } else {
          embed.setTitle(`${apiData.data.profileData.username}'s Profile`);
        }

        embed.setDescription(
          `Last Online ${apiData.data.profileSession.lastOnlineDiff} on ${apiData.data.profileSession.server}`
        )
        .setThumbnail(apiData.data.profilePicture)
        .setColor(Colors.Blurple)
        .addFields(
          {
            name: "Date Joined",
            value: `${moment(apiData.data.profileData.joined).format('LLLL')} (${moment(apiData.data.profileData.joined).fromNow()})`,
            inline: false,
          },
          {
            name: "Total Logins",
            value: `${apiData.data.profileStats.totalLogins}`,
            inline: true,
          },
          {
            name: "Total Playtime",
            value: `${apiData.data.profileStats.totalPlaytime}`,
            inline: true,
          }
        );

      interaction.reply({
        embeds: [embed],
        empheral: false,
      });
    }
  }
}
