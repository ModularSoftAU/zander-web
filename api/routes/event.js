import { MessageEmbed } from 'discord.js'
import {isFeatureEnabled, required, optional} from '../common'

export default function eventApiRoute(app, client, moment, config, db, features, lang) {
    const baseEndpoint = '/api/event';

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.events, res, lang);
        const published = optional(req.query, "published");
        const id = optional(req.query, "id");

        try {
            function getEvents(dbQuery) {
                db.query(dbQuery, function(error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }

                    if (!results.length) {
                        return res.send({
                            success: false,
                            message: lang.event.noEventsScheduled
                        });
                    }

                    res.send({
                        success: true,
                        data: results
                    });
                });
            }

            // Get Event by specific ID.
            if (id) {
                let dbQuery = `SELECT * FROM events WHERE eventId=${id};`
                getEvents(dbQuery);                
            }

            if (published === 'show') {
                let dbQuery = `SELECT * FROM events WHERE published=1 ORDER BY eventDateTime ASC;`
                getEvents(dbQuery);
            }

            if (published === 'hide') {
                let dbQuery = `SELECT * FROM events WHERE published=0 ORDER BY eventDateTime ASC;`
                getEvents(dbQuery);
            }

            if (published === 'all') {
                let dbQuery = `SELECT * FROM events ORDER BY eventDateTime ASC;`
                getEvents(dbQuery);
            }

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.events, res, lang);
        const name = required(req.body, "eventName", res);
        const icon = required(req.body, "eventIcon", res);
        const eventDateTime = required(req.body, "eventDateTime", res);
        const information = required(req.body, "eventInformation", res);

        const eventCreatedLang = lang.event.eventCreated;

        try {
            db.query(`INSERT INTO events (name, icon, eventDateTime, information) VALUES (?, ?, ?, ?)`, [name, icon, eventDateTime, information], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: eventCreatedLang.replace("%NAME%", name)
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        isFeatureEnabled(features.events, res, lang);
        const name = required(req.body, "eventName", res);
        const icon = required(req.body, "eventIcon", res);
        const eventDateTime = required(req.body, "eventDateTime", res);
        const information = required(req.body, "eventInformation", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/publish', async function(req, res) {
        isFeatureEnabled(features.events, res, lang);
        const eventId = required(req.body, "eventId", res);

        try {
            db.query(`SELECT * FROM events where eventId=? AND published=?; select name, icon, eventDateTime, information; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId, `1`, eventId], function (error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                // shadowolf: 
                // DONE: This is where the event will send a message to the `eventAnnouncements` indicated in config.json
                // It will also create a scheduled event and amend the link to the event announcement.

                try {
                    const guild = client.guilds.cache.get(config.discord.guildId);
                    const eventInfo = results[1][0];

                    db.query(`SELECT * FROM events where eventId=? AND published=?; select name, icon, eventDateTime, information; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId, `1`, eventId], function (error, results, fields) {
                        if (error) {
                            return res.send({
                                success: false,
                                message: `${error}`
                            });
                        }

                        // Create Scheduled Event
                        guild.scheduledEvents.create({
                            name: `${eventInfo.name}`,
                            scheduledStartTime: `${eventInfo.eventDateTime}`,
                            privacyLevel: 'GUILD_ONLY',
                            description: `Hosted on ${eventInfo.hostingServerName}\n${eventInfo.information}`,
                            entityType: 'VOICE',
                            channel: guild.channels.cache.get(`${eventInfo.guildEventChannel}`)
                        })

                        // Event will send a message to the `eventAnnouncements` indicated in config.json
                        const channel = guild.channels.cache.get(config.discord.channels.eventAnnouncements);

                        const embed = new MessageEmbed()
                            .setTitle(`:calendar: NEW EVENT: ${eventInfo.name}`)
                            .setThumbnail(`${eventInfo.icon}`)
                            .setDescription(`${eventInfo.information}\n\n Event starting at ${moment(eventInfo.eventDateTime).format('MMMM Do YYYY, h:mm:ss a')}\nHosted on ${eventInfo.hostingServerName}`)
                            .setFooter(`To stay notified of when the event will begin, mark yourself as Interested in the Events tab on the sidebar.`)

                        channel.send({ embeds: [embed] });

                        return res.redirect(`${process.env.siteAddress}/dashboard/events`);
                    });
                } catch (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
            });
        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.events, res, lang);
        const eventId = required(req.body, "eventId", res);

        try {
            db.query(`SELECT eventId FROM events WHERE eventId=?; DELETE FROM events WHERE eventId=?;`, [eventId, eventId], function (error, results, fields) {
                if (error) {
                    console.log(error);
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: `The event with the id ${eventId} has been deleted.`
                });
            });

        } catch (error) {
            console.log(error);
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });
}