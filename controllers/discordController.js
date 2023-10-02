import db from './databaseController';
import { SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord.js';

// 
// Discord
//
export const client = new SapphireClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
    presence: {
        status: "online",
        activities: [{
            name: process.env.siteAddress,
            type: 'PLAYING'
        }]
    }
});

client.login(process.env.discordAPIKey);

/*
    Takes a username as input and returns a Promise. 
    It queries a database to check if the user is linked to a Discord account. 
    If there is an error in the query, it rejects the Promise with the error. 
    If there are no results, it resolves the Promise with false. 
    If the user is linked to a Discord account, it resolves the Promise with true.

    @param username The username of the user.
*/
export async function isUserLinkedToDiscord(username) {
    return new Promise((resolve, reject) => {
        db.query(`SELECT discordID FROM users WHERE username=?;`, [username], function (error, results, fields) {
            if (error) {
                reject(error);
            }

            if (!results || !results.length) {
                resolve(false);
            }

            let discordID = results[0].discordID;

            if (discordID == null) {
                resolve(false);
            } else {
                resolve(true);
            }            
        });
    });
}

/*
    It queries a database to retrieve the Discord ID of a user based on their username. 
    If there is an error in the query, it rejects the Promise with the error. 
    If there are no results, it resolves the Promise with false. 
    If the user is linked to a Discord account, it resolves the Promise with their Discord ID.

    @param username The username of the user.
*/
export async function getDiscordIdByUsername(username) {
    return new Promise((resolve, reject) => {
        db.query(`SELECT discordID FROM users WHERE username=?;`, [username], function (error, results, fields) {
            if (error) {
                reject(error);
            }

            if (!results || !results.length) {
                resolve(false);
            }

            let discordID = results[0].discordID;

            if (discordID == null) {
                resolve(null);
            } else {
                resolve(discordID);
            }
        });
    });
}

/*
    It queries a database to retrieve the Discord ID of a user based on their username. 
    If there is an error in the query, it rejects the Promise with the error. 
    If there are no results, it resolves the Promise with false. 
    If the user is linked to a Discord account, it resolves the Promise with their Discord ID.

    @param username The username of the user.
*/
export async function getUsernameByDiscordId(discordID) {
    return new Promise((resolve, reject) => {
        db.query(`SELECT username FROM users WHERE discordID=?;`, [discordID], function (error, results, fields) {
            if (error) {
                reject(error);
            }

            if (!results[0] || !results.length) {
                resolve(false);
            }

            if (results[0] && results[0].username != null) {
                resolve(results[0].username);
            } else {
                resolve(false);
            }
        });
    });
}

/*
    It

    @param username The username of the user.
*/
export async function isBot() {
    const user = client.users.cache.get(userId);
    if (user) {
        return user.bot;
    }
    return false;
}