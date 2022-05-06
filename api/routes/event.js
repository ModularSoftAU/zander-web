import { MessageEmbed } from 'discord.js'
import {isFeatureEnabled, required, optional} from '../common'

export default function eventApiRoute(app, client, moment, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/event';

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
        isFeatureEnabled(features.events, res, lang);
        const name = required(req.body, "name", res);
        const icon = required(req.body, "icon", res);
        const eventDateTime = required(req.body, "eventDateTime", res);
        const hostingServer = required(req.body, "hostingServer", res);
        const guildEventChannel = required(req.body, "guildEventChannel", res);
        const information = required(req.body, "information", res);

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
        isFeatureEnabled(features.events, res, lang);
        const name = required(req.body, "name", res);
        const icon = required(req.body, "icon", res);
        const eventDateTime = required(req.body, "eventDateTime", res);
        const hostingServer = required(req.body, "hostingServer", res);
        const guildEventChannel = required(req.body, "guildEventChannel", res);
        const information = required(req.body, "information", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/publish', async function(req, res) {
        isFeatureEnabled(features.events, res, lang);
        const eventId = required(req.body, "eventId", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.events, res, lang);
        const eventId = required(req.body, "eventId", res);

        // ...
        res.send({ success: true });
    });
}