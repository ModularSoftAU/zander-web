import { setAuditLastMinecraftLogin, setAuditLastMinecraftMessage } from '../../controllers/userController';
import {isFeatureEnabled, required, optional} from '../common'

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
        isFeatureEnabled(features.discord, res, lang);
        const username = required(req.body, "username", res);
        const server = required(req.body, "server", res);
        const content = required(req.body, "content", res);

        try {
            const guild = client.guilds.cache.get(config.discord.guildId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`**${server}**  |  \`${username}\` :: ${content}`);

            setAuditLastMinecraftMessage(username, res);

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
        isFeatureEnabled(features.discord, res, lang);
        const username = required(req.body, "username", res);

        try {
            const guild = client.guilds.cache.get(config.discord.guildId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);

            channel.send(`:ballot_box_with_check:  | \`${username}\` has joined the Network.`);

            setAuditLastMinecraftLogin(username, res);

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
    });

    app.post(baseEndpoint + '/directMessage', async function(req, res) {
        isFeatureEnabled(features.discord, res, lang);
                
        const senderUsername = required(req.body, "senderUsername", res);
        const recipientUsername = required(req.body, "recipientUsername", res);
        const server = required(req.body, "server", res);
        const content = required(req.body, "content", res);

        try {
            const guild = client.guilds.cache.get(config.discord.guildId);
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