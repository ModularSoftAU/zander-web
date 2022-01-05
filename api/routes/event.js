const baseEndpoint = config.siteConfiguration.apiRoute + '/event';
import { MessageEmbed } from 'discord.js'

export default function eventApiRoute(app, DiscordClient, moment, config, db) {

    app.get(baseEndpoint + '/get', async function(req, res) {
        try {
            const published = req.query.published;

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
                            message: `There are currently no community events scheduled.`
                        });
                    }

                    res.send({
                        success: true,
                        data: results
                    });
                });
            }

            if (!published) {
                res.send({
                    success: false,
                    message: `You must select a publish indicator.`
                });
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
        const name = req.body.name;
        const icon = req.body.icon;
        const eventDateTime = req.body.eventDateTime;
        const hostingServer = req.body.hostingServer;
        const guildEventChannel = req.body.guildEventChannel;
        const information = req.body.information;

        try {
            db.query(`INSERT INTO events (name, icon, eventDateTime, hostingServer, guildEventChannel, information) VALUES (?, ?, ?, (select serverId from servers where name=?), ?, ?)`, [name, icon, eventDateTime, hostingServer, guildEventChannel, information], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The event ${name} has been successfully created!`
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
        const name = req.body.name;
        const icon = req.body.icon;
        const eventDateTime = req.body.eventDateTime;
        const hostingServer = req.body.hostingServer;
        const guildEventChannel = req.body.guildEventChannel;
        const information = req.body.information;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const eventId = req.body.eventId;

        try {
            db.query(`SELECT eventId FROM events WHERE eventId=?; DELETE FROM events WHERE eventId=?`, [eventId, eventId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results[0].length) {
                    return res.send({
                        success: false,
                        message: `The event with the id ${eventId} does not exist.`
                    });
                }

                return res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/events`);
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/publish', async function(req, res) {
        const eventId = req.body.eventId;

        try {
            db.query(`SELECT * FROM events where eventId=? AND published=?; select name, icon, eventDateTime, information, (select name from servers where serverId=hostingServer) as 'hostingServerName' from events where eventId=?; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId, `1`, eventId], function(error, results, fields) {
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
                    const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
                    const eventInfo = results[1][0];

                    db.query(`SELECT * FROM events where eventId=? AND published=?; select name, icon, eventDateTime, information, (select name from servers where serverId=hostingServer) as 'hostingServerName' from events where eventId=?; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId, `1`, eventId], function(error, results, fields) {
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

                        return res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/events`);
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

}