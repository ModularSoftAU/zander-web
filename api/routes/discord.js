const baseEndpoint = config.siteConfiguration.apiRoute + '/discord';

export default function discordApiRoute(app, DiscordClient, config, db) {

    app.post(baseEndpoint + '/switch', async function(req, res) {
        const username = req.body.username;
        const server = req.body.server;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:twisted_rightwards_arrows:  |  \`${username}\` switched to \`${server}\``);

            res.send({
                success: true
            });
        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/chat', async function(req, res) {
        const username = req.body.username;
        const server = req.body.server;
        const content = req.body.content;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`**${server}**  |  \`${username}\` :: ${content}`);

            res.send({
                success: true
            });
        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/join', async function(req, res) {
        const username = req.body.username;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:ballot_box_with_check:  | \`${username}\` has joined the Network.`);

            res.send({
                success: true
            });
        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/leave', async function(req, res) {
        const username = req.body.username;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:negative_squared_cross_mark:  | \`${username}\` has left the Network.`);

            res.send({
                success: true
            });
        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/directMessage', async function(req, res) {
        const senderUsername = req.body.senderUsername;
        const recipientUsername = req.body.recipientUsername;
        const server = req.body.server;
        const content = req.body.content;

        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:e_mail: | **${server}** | \`${senderUsername}\` **=>** \`${recipientUsername}\` :: ${content}`);

            res.send({
                success: true
            });
        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

}