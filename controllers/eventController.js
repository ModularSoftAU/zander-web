import moment from 'moment';
import db from './databaseController';
import config from '../config.json' assert {type: "json"};
import { MessageEmbed } from 'discord.js';
import { generateLog } from '../api/common';

/*
    Clears old events from the database by running a SQL query that 
    deletes events with a datetime earlier than the current moment. 
    If an error occurs, it is thrown and logged to the console. 
    If the function completes successfully, 
    a message is logged to the console indicating that old events have been cleared.
*/
export function clearOldEvents() {
    try {        
        db.query(`DELETE FROM events WHERE eventdatetime < "${moment().format('YYYY-MM-DD HH:mm:ss')}"`, function (err, results) {
            if (err) {
                throw err;
            } else {
                console.log(`[CONSOLE] [CRON] Old Events have been cleared.`);
            }
        });
    } catch (error) {
        console.log(error);
        return res.send({
            success: false,
            message: `${error}`
        });
    }
}

/*
    Checks if an event with a given ID is published or not. 
    It uses a MySQL query to select events from the database where the event ID matches the given ID and is published. 
    It returns a promise that resolves to a boolean value indicating if the event is published or not. 
    If an error occurs during the database query, the promise is rejected with the error message.

    @param eventId The ID of the Event.
*/
export async function isEventPublished(eventId) {
    return new Promise((resolve, reject) => {
        db.query(`SELECT * FROM events where eventId=? AND published=?;`, [eventId, 1], function (error, results, fields) {
            if (error) {
                reject(error);
            }

            if (!results || !results.length) {
                resolve(false);
            }

            resolve(true);
        });
    });
}

/*
    Checks if an event exists in the database by its event ID. 
    It returns a promise that resolves to a boolean value indicating whether the event exists or not. 
    It uses a SQL query to select the event from the events table, 
    and checks the result to determine whether the event exists or not. 
    If there is an error in the SQL query, the promise is rejected with the error message.

    @param eventId The ID of the Event.
*/
export async function doesEventExist(eventId) {
    return new Promise((resolve, reject) => {
        db.query(`SELECT * FROM events where eventId=?;`, [eventId], function (error, results, fields) {
            if (error) {
                reject(error);
            }

            if (!results || !results.length) {
                resolve(false);
            }

            resolve(true);
        });
    });
}

/*
    Runs a database query to select all columns from a table called "events" 
    where the eventId matches the provided eventId parameter. 
    If the query returns an error, the promise is rejected with the error. 
    If the query returns results, the promise is resolved with the first result object in the results array.

    @param eventId The ID of the Event.
*/
export function getEventInfo(eventId) {
    return new Promise((resolve, reject) => {
        db.query(`SELECT * FROM events where eventId=?;`, [eventId], function (err, results) {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
}

/*
    Updates the corresponding event's published column to 1 in the database.

    @param eventId The ID of the Event.
*/
export function setEventAsPublished(eventId) {
    try {
        db.query(`UPDATE events SET published=? WHERE eventId=?`, [1, eventId], function (err, results) {
            if (err) {
                throw err;
            } else {
                return results[0];
            }
        });
    } catch (error) {
        console.log(error);
        return res.send({
            success: false,
            message: `${error}`
        });
    }
}

/*
    Creates a new scheduled event in a Discord guild and sends an announcement message in a specific channel. 
    The function takes in eventInfo, client, and res as parameters. 
    The eventInfo parameter contains information about the event such as name, start and end times, location, description, and icon. 
    The client parameter is the Discord bot client used to create and send messages. 
    The res parameter is the response object used to send responses back to the client.
    
    Inside the function, the scheduled event is created using the guild.scheduledEvents.create() method, 
    passing in the event information, privacy level, entity type, entity metadata (including location), and description. 
    A message is then created using the MessageEmbed() constructor, 
    and the event details are added to the message. Finally, the message is sent to the eventAnnouncements channel in the 
    guild using the channel.send() method. If an error occurs, it is caught and a response object is sent back with an error message.

    @param eventInfo The object that provides all of the event information.
*/
export function createDiscordEvent(eventInfo, client, res) {
    try {
        // 
        // Create Scheduled Event
        // 
        const guild = client.guilds.cache.get(config.discord.guildId);

        guild.scheduledEvents.create({
            name: `${eventInfo.name}`,
            scheduledStartTime: `${eventInfo.eventStartDateTime}`,
            scheduledEndTime: `${eventInfo.eventEndDateTime}`,
            privacyLevel: 'GUILD_ONLY',
            entityType: 'EXTERNAL',
            entityMetadata: {
                location: `${eventInfo.location}`
            },
            description: `${eventInfo.information}`
        })

        // 
        // Event will send a message to the `eventAnnouncements` indicated in config.json
        // 
        const channel = guild.channels.cache.get(config.discord.channels.eventAnnouncements);

        const embed = new MessageEmbed()
            .setTitle(`:calendar: NEW EVENT: ${eventInfo.name}`)
            .setThumbnail(`${eventInfo.icon}`)
            .setDescription(`${eventInfo.information}\n\n Event starting at ${moment(eventInfo.eventDateTime).format('MMMM Do YYYY, h:mm:ss a')}`)
            .setFooter(`To stay notified of when the event will begin, mark yourself as Interested in the Events tab on the sidebar.`)

        channel.send({ embeds: [embed] });

        generateLog(actioningUser, "SUCCESS", "EVENTS", `Event ${eventInfo.name} information has been published to Discord.`, res);
        
    } catch (error) {
        console.log(error);
        return res.send({
            success: false,
            message: `${error}`
        });
    }
}