import { Command, RegisterBehavior } from "@sapphire/framework";
import { Colors, EmbedBuilder } from "discord.js";
import features from "../features.json" assert { type: "json" };

export class RanksCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName("vote")
        .setDescription(
          "Display link to vote for the Network and the current leaderboard."
        )
    );
  }

  async chatInputRun(interaction) {
    if (!features.vote) {
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

    // Fetch vote data
    const voteFetchURL = `${process.env.siteAddress}/api/vote/get?stats=true`;
    const voteResponse = await fetch(voteFetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const voteApiData = await voteResponse.json();

    const voteSiteFetchURL = `${process.env.siteAddress}/api/vote/site/get`;
    const voteSiteResponse = await fetch(voteSiteFetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const voteSiteApiData = await voteSiteResponse.json();

    // Build the embed with voting details
    const embed = new EmbedBuilder()
      .setTitle(`Vote`)
      .setDescription(
        `Voting for our server helps us grow by increasing our visibility. The more votes we receive, the higher we rank, attracting new players to our community. As a thank-you, we offer exciting perks and rewards to our top voters each month!`
      )
      .setColor(Colors.DarkGold);

    // Add vote sites
    const voteSites = voteSiteApiData.data.map(
      (site) =>
        `${site.voteSiteDisplayName}: [Vote Here](${site.voteSiteRedirect})`
    );
    embed.addFields({
      name: "How to Vote",
      value: `Click on the vote buttons below, follow the instructions on each site, and vote daily to maximize your rewards! Every vote makes a difference—thank you for supporting our server! 🚀`,
    });

    embed.addFields({
      name: "Voting Sites",
      value: voteSites.join("\n"),
    });

    // Add leaderboard info
    if (voteApiData.data && voteApiData.data.length > 0) {
      const topVotes = voteApiData.data
        .slice(0, 10)
        .map(
          (voteUser) => `${voteUser.username} - ${voteUser.total_votes} votes`
        );
      embed.addFields({
        name: "Voting Leaderboard",
        value: topVotes.join("\n") || "No votes yet!",
      });
    } else {
      embed.addFields({
        name: "Voting Leaderboard",
        value: "No votes yet, but you can be the first!",
      });
    }

    return interaction.reply({
      embeds: [embed],
      ephemeral: false,
    });
  }
}
