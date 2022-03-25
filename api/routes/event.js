import { MessageEmbed } from 'discord.js'

export default function eventApiRoute(app, DiscordClient, moment, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/event';

    app.get(baseEndpoint + '/get', async function(req, res) {
        if (features.events == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        try {
            const published = req.query.published;
            const id = req.query.id;

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

            // Get Event by specific ID.
            if (id) {
                let dbQuery = `SELECT * FROM events WHERE eventId=${id};`
                getEvents(dbQuery);                
            }

            // if (!published) {
            //     res.send({
            //         success: false,
            //         message: `You must select a publish indicator.`
            //     });
            // }

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
        if (features.events == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const name = req.body.eventName;
        const icon = req.body.eventIcon;
        const eventDateTime = req.body.eventDateTime;
        const hostingServer = req.body.eventHostingServer;
        const guildEventChannel = req.body.guildEventChannel;
        const information = req.body.eventInformation;

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
        if (features.events == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }
        
        const name = req.body.name;
        const icon = req.body.icon;
        const eventDateTime = req.body.eventDateTime;
        const hostingServer = req.body.hostingServer;
        const guildEventChannel = req.body.guildEventChannel;
        const information = req.body.information;

        // ...
        res.send({ success: true });
    });
}