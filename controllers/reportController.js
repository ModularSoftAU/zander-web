import config from '../config.json' assert {type: "json"};
import { MessageEmbed } from 'discord.js';

/*
    Creates a Discord message embed with information about the report, 
    including the reported user, reporter user, reason for the report, evidence, and server.
    The function then sends the message embed to the reports channel in the Discord server specified in config.json.
    If an error occurs, the function logs the error and returns a response object with a message indicating the error.

    @param reportedUser The user being reported.
    @param reporterUser The user that is reporting the user.
    @param reason The reason for the report.
    @param evidence Supporting evidence for the report of this user.
    @param platform The platform of this report for this user.
    @param server The specified server the user selects
*/
export function sendReportDiscord(reportedUser, reporterUser, reason, evidence, platform, server, client, res) {
    try {
        //
        // Report will send a message to the `reports` indicated in config.json
        // 
        const guild = client.guilds.cache.get(config.discord.guildId);
        const channel = guild.channels.cache.get(config.discord.channels.reports);

        const embed = new MessageEmbed()
            .setTitle(`Incoming ${platform} Report from ${reporterUser}`)
            .setColor('#FFA500')

            .addField(`Reported User`, `${reportedUser}`, true)
            .addField(`Reporter User`, `${reporterUser}`, true)
            .addField(`Reason`, `${reason}`)
            .addField(`Server`, `${server}`)
            .addField(`Evidence`, `${evidence}`)

        channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.log(error);
        return res.send({
            success: false,
            message: `${error}`
        });
    }
}