const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/discord";


module.exports = (app, DiscordClient) => {

    router.post(baseEndpoint + '/switch', (req, res, next, DiscordClient) => {

        console.log(`Working?`);

        const username = req.body.username;
        const server = req.body.server;
    
        try {
            const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
            const channel = guild.channels.cache.get(config.discord.channels.networkChatLog);
        
            channel.send(`:twisted_rightwards_arrows:  |  \`${username}\` switched to \`${server}\`.`);
    
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
    
    router.post(baseEndpoint + '/chat', (req, res, next) => {
        const username = req.body.username;
        const server = req.body.server;
        const content = req.body.content;
    
        // ...
        res.json({ success: true });
    });
    
    router.post(baseEndpoint + '/join', (req, res, next) => {
        const username = req.body.username;
    
        // ...
        res.json({ success: true });
    });
    
    router.post(baseEndpoint + '/leave', (req, res, next) => {
        const username = req.body.username;
    
        // ...
        res.json({ success: true });
    });
    
    router.post(baseEndpoint + '/directMessage', (req, res, next) => {
        const senderUsername = req.body.senderUsername;
        const recipientUsername = req.body.recipientUsername;
        const server = req.body.server;
        const content = req.body.content;
    
        // ...
        res.json({ success: true });
    });
    
}

// module.exports = router