import { Command, RegisterBehavior } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import moment from "moment";
import fetch from "node-fetch";
import { getProfilePicture } from "../controllers/userController.js";
import { resolveDiscordUserId } from "../lib/discord/resolveDiscordMember.mjs";

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
          option
            .setName("username")
            .setDescription("Minecraft username of the profile to fetch.")
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName("discord_user")
            .setDescription("Discord user to fetch the linked profile for.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("discord_tag")
            .setDescription(
              "Discord tag, ID, or @username of the profile to fetch."
            )
            .setRequired(false)
        )
    );
  }

  async chatInputRun(interaction) {
    const username = interaction.options.getString("username");
    const discordUser = interaction.options.getUser("discord_user");
    const discordTag = interaction.options.getString("discord_tag");

    if (!username && !discordUser && !discordTag) {
      return interaction.reply({
        content:
          "Please provide either a Minecraft username or a Discord user/tag to look up a profile.",
        ephemeral: true,
      });
    }

    const fetchURL = new URL(
      `${process.env.siteAddress}/api/user/profile/get`
    );

    if (username) {
      fetchURL.searchParams.set("username", username);
    } else {
      const resolvedDiscordId = await resolveDiscordUserId(interaction, {
        discordUser,
        discordTag,
      });

      if (!resolvedDiscordId) {
        return interaction.reply({
          content:
            "Unable to resolve the provided Discord information to a linked account.",
          ephemeral: true,
        });
      }

      fetchURL.searchParams.set("discordId", resolvedDiscordId);
    }

    let response;
    let apiData;
    try {
      response = await fetch(fetchURL, {
        headers: { "x-access-token": process.env.apiKey },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      apiData = await response.json();
    } catch (err) {
      console.error("[profile command] API fetch failed:", err.message);
      return interaction.reply({
        content: "Failed to reach the profile API. Please try again later.",
        ephemeral: true,
      });
    }

    if (!apiData.success) {
      const noProfileEmbed = new EmbedBuilder()
        .setTitle(`Could not fetch profile.`)
        .setDescription(`User either does not exist or there was an issue fetching profile.`)
        .setColor(Colors.Red);

      interaction.reply({
        embeds: [noProfileEmbed],
      });
    } else {
      let isLinked = apiData.data.profileData.discordId;
      let profilePicture = await getProfilePicture(apiData.data.profileData.username);

      const embed = new EmbedBuilder();

      if (isLinked) {
        embed.setTitle(`\`${apiData.data.profileData.username}\`'s Profile ✅`);
      } else {
        embed.setTitle(`${apiData.data.profileData.username}'s Profile`);
      }

      const session = apiData.data.profileSession || {};
      const serverName = session.server
        ? `${session.server.charAt(0).toUpperCase()}${session.server.slice(1)}`
        : "the network";

      let statusLine = "";

      if (session.isOnline) {
        statusLine = `Currently Online on ${serverName}`;
      } else if (session.lastOnlineDiff) {
        statusLine = `Last Online ${session.lastOnlineDiff} ago on ${serverName}`;
      } else {
        statusLine = "Last online information unavailable";
      }

      embed
        .setDescription(statusLine)
        .setColor(Colors.Blurple)
        .setThumbnail(profilePicture)
        .addFields(
          {
            name: "Date Joined",
            value: `${moment(apiData.data.profileData.joined).format(
              "LLLL"
            )} (${moment(apiData.data.profileData.joined).fromNow()})`,
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

      // Fetch and display badges
      try {
        const badgeRes = await fetch(
          `${process.env.siteAddress}/api/badges/user/${encodeURIComponent(apiData.data.profileData.username)}`,
          { headers: { "x-access-token": process.env.apiKey } }
        );
        const badgeData = await badgeRes.json();

        if (badgeData.success && badgeData.data && badgeData.data.length > 0) {
          const MAX_SHOWN = 5;
          const badges = badgeData.data;
          const shown = badges.slice(0, MAX_SHOWN);
          const extra = badges.length - shown.length;

          const badgeLines = shown.map((b) => `🏅 ${b.name}`).join("\n");
          const badgeValue = extra > 0
            ? `${badgeLines}\n*+${extra} more — [view profile](${process.env.siteAddress}/profile/${apiData.data.profileData.username})*`
            : badgeLines;

          embed.addFields({ name: "Badges", value: badgeValue, inline: false });
        }
      } catch (_) {
        // badges unavailable — profile still renders without them
      }

      interaction.reply({ embeds: [embed] });
    }
  }
}
