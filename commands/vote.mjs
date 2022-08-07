import { Command, RegisterBehavior } from '@sapphire/framework';
import { MessageEmbed } from 'discord.js';
import config from '../config.json' assert {type: "json"};
import fetch from 'node-fetch';
import features from '../features.json' assert {type: "json"};

export class VoteCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: 'vote',
      description: 'Display information for voting along with the Top Voter',
      chatInputCommand: {
        register: true,
        behaviorWhenNotIdentical: RegisterBehavior.Overwrite
      }
    });
  }

  async chatInputRun(interaction) {
    if (features.vote) {
      const voteFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/vote/get`;
      const voteResponse = await fetch(voteFetchURL);
      const voteApiData = await voteResponse.json();
      console.log(voteApiData);
      
      if (voteApiData.success) {
        const topVoterEntry = voteApiData.data[0];
        
        const voteWithTopVoterEmbed = new MessageEmbed()
          .setTitle(`Voting`)
          .setDescription(`You can help our Network grow, along with getting awesome perks being the Top Voter! Visit ${config.siteConfiguration.siteAddress}/vote to start voting!\nYou need to beat ${topVoterEntry.username} with **${topVoterEntry.votes}**.\nGood Luck!`)
          .setURL(`${config.siteConfiguration.siteAddress}/vote`) 
        
          interaction.reply({
            embeds: [voteWithTopVoterEmbed],
            empheral: true
          });
      } else {
        const voteWithNotVotesEmbed = new MessageEmbed()
          .setTitle(`Voting`)
          .setDescription(`You can help our Network grow long with getting awesome perks being the Top Voter! Visit ${config.siteConfiguration.siteAddress}/vote to start voting!\n**There are no votes yet! You could be the first!**`)
          .setURL(`${config.siteConfiguration.siteAddress}/vote`)

          interaction.reply({
            embeds: [voteWithNotVotesEmbed],
            empheral: true
          });
      } 
    } else {
      interaction.reply("This feature has been disabled by the System Administrator.");
    }
  }
}