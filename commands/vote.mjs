import { Command } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};
import fetch from 'node-fetch';

export class RulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'vote',
      description: 'Display information along with the Top Voter'
    });
  }

  async messageRun(message) {
    try {
      const voteFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/vote/get`;
      const voteResponse = await fetch(voteFetchURL);
      const voteApiData = await voteResponse.json();
      const topVoterEntry = voteApiData.data[0];

      const embed = new MessageEmbed()
      .setTitle(`Voting`)
      .setDescription(`You can help our Network grow long with getting awesome perks being the Top Voter! Visit ${config.siteConfiguration.siteAddress}/vote to start voting!\nYou need to beat ${topVoterEntry.username} with **${topVoterEntry.votes}**.\nGood Luck!`)
      .setURL(`${config.siteConfiguration.siteAddress}/vote`)

      message.reply({
        embeds: [embed],
        empheral: true
      });                      
    } catch (error) {
      console.log(error);
      return
    }
  }
}