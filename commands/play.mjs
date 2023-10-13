import { Command, RegisterBehavior } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export class PlayCommand extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'play',
            description: 'Display all Network servers to play on.',
            chatInputCommand: {
                register: true,
                behaviorWhenNotIdentical: RegisterBehavior.Overwrite
            }
        });
    }

    async chatInputRun(interaction) {
        const fetchURL = `${process.env.siteAddress}/api/server/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        const embed = new EmbedBuilder()
            .setTitle(`Network Servers`)
            .setDescription(`Get started! Jump on and play with our community!`)

        // Loop through the server data and add them to the embed
        apiData.data.forEach(server => {
            embed.addField(server.displayName, `${server.serverConnectionAddress}`);
        });

        interaction.reply({
            embeds: [embed],
            ephemeral: true // Corrected 'empheral' to 'ephemeral'
        });
    }
}