const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/discord";

module.exports = (app, DiscordClient) => {

    app.post(baseEndpoint + '/switch', (req, res, next) => {
        const username = req.body.username;
        const server = req.body.server;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:twisted_rightwards_arrows:  |  \`${username}\` switched to \`${server}\``);

            res.json({
                success: true
            });
        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/chat', (req, res, next) => {
        const username = req.body.username;
        const server = req.body.server;
        const content = req.body.content;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`**${server}**  |  \`${username}\` :: ${content}`);

            res.json({
                success: true
            });
        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/join', (req, res, next) => {
        const username = req.body.username;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:ballot_box_with_check:  | \`${username}\` has joined the Network.`);

            res.json({
                success: true
            });
        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/leave', (req, res, next) => {
        const username = req.body.username;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:negative_squared_cross_mark:  | \`${username}\` has left the Network.`);

            res.json({
                success: true
            });
        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/directMessage', (req, res, next) => {
        const senderUsername = req.body.senderUsername;
        const recipientUsername = req.body.recipientUsername;
        const server = req.body.server;
        const content = req.body.content;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:e_mail: | **${server}** | \`${senderUsername}\` **=>** \`${recipientUsername}\` :: ${content}`);

            res.json({
                success: true
            });
        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

}
