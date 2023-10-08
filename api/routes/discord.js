import { isFeatureEnabled, required } from '../common'

export default function discordApiRoute(app, client, config, db, features, lang) {
    const baseEndpoint = '/api/discord';

    app.post(baseEndpoint + '/switch', async function(req, res) {
        isFeatureEnabled(features.discord, res, lang);
        const username = required(req.body, "username", res);
        const server = required(req.body, "server", res);

        try {
            const guild = client.guilds.cache.get(config.discord.guildId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:twisted_rightwards_arrows:  |  \`${username}\` switched to \`${server}\``);

            return res.send({
                success: true
            });
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }

        return res;
    });

    app.post(baseEndpoint + '/chat', async function(req, res) {
        isFeatureEnabled(features.discord, res, lang);
        const username = required(req.body, "username", res);
        const server = required(req.body, "server", res);
        const content = required(req.body, "content", res);

        try {
            const guild = client.guilds.cache.get(config.discord.guildId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`**${server}**  |  \`${username}\` :: ${content}`);

            setAuditLastMinecraftMessage(username, res);

            return res.send({
                success: true
            });
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/join', async function (req, res) {
        isFeatureEnabled(features.discord, res, lang);
        const username = required(req.body, "username", res);

        try {
            const guild = client.guilds.cache.get(config.discord.guildId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:ballot_box_with_check:  | \`${username}\` has joined the Network.`);
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/leave', async function(req, res) {
        isFeatureEnabled(features.discord, res, lang);
        const username = required(req.body, "username", res);

        try {
            const guild = client.guilds.cache.get(config.discord.guildId);
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

        return res;
    });

}