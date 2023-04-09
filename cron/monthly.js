import cron from 'node-cron';
import fetch from 'node-fetch';
import config from '../config.json' assert {type: "json"};
import db from '../controllers/databaseController';
import { MessageEmbed } from 'discord.js';

// 
// MONTHLY Cron Jobs [Firing at 7:00am]
// 
export default async function monthlyCron(client) {
    const clearAllVotesTask = cron.schedule('0 7 * * *', async function() {
        // This will fire on the first of every month at 7:00am and will clear all votes from the votes table.

        try {
            const voteFetchURL = `${process.env.siteAddress}/api/vote/get`;
            const voteResponse = await fetch(voteFetchURL);
            const voteApiData = await voteResponse.json();
            const topVoterEntry = voteApiData.data[0];

            const guild = client.guilds.cache.get(config.discord.guildId);
            const topVoterBroadcastChannel = guild.channels.cache.get(config.discord.channels.topVoterBroadcast);
            if (!topVoterBroadcastChannel) return console.log(`A Top Voter channel does not exist.`);

            const embed = new MessageEmbed()
                .setTitle(`:ballot_box: Voting Winner :ballot_box:`)
                .setDescription(`The votes are in! **${topVoterEntry.username}** has gained Top Voter for this month with **${topVoterEntry.votes} votes**.\nThe votes have started again! Go to ${process.env.siteAddress}/vote to get started!`)
                .setColor('#cbff7c')
            topVoterBroadcastChannel.send({ embeds: [embed] });

            database.query (`truncate votes`, function (err, results) {
                if (err) {
                    throw err;
                } else {
                    console.log(`[CONSOLE] [CRON] Votes table has been cleared and message broadcasted.`);
                }
            });
        } catch (error) {
            console.log(error);
            return;
        }     
      
    }, {
        scheduled: true,
        timezone: process.env.TZ
     });
     
    clearAllVotesTask.start();
}