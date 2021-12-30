const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/discord";

module.exports = (app, DiscordClient) => {

    app.post(baseEndpoint + '/switch', (req, res, next) => {
        const username = req.body.username;
        const server = req.body.server;

        console.log("Username: " + username);
        console.log("Server: " + server);

        try {
            // console.log(DiscordClient.guilds.cache.get(config.discord.serverId));
            console.log(DiscordClient);

            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:twisted_rightwards_arrows:  |  \`${username}\` switched to \`${server}\`.`);

            res.json({
                success: true
            });
        } catch (error) {
            console.log(error);
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

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/join', (req, res, next) => {
        const username = req.body.username;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/leave', (req, res, next) => {
        const username = req.body.username;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/directMessage', (req, res, next) => {
        const senderUsername = req.body.senderUsername;
        const recipientUsername = req.body.recipientUsername;
        const server = req.body.server;
        const content = req.body.content;

        // ...
        res.json({ success: true });
    });

}