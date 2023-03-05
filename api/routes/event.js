import { createDiscordEvent, doesEventExist, getEventInfo, isEventPublished, setEventAsPublished } from '../../controllers/eventController';
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
                let dbQuery = `SELECT * FROM events WHERE published=1 ORDER BY eventStartDateTime ASC;`
                getEvents(dbQuery);
            }

            if (published === 'hide') {
                let dbQuery = `SELECT * FROM events WHERE published=0 ORDER BY eventStartDateTime ASC;`
                getEvents(dbQuery);
            }

            if (published === 'all') {
                let dbQuery = `SELECT * FROM events ORDER BY eventStartDateTime ASC;`
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
        const eventStartDateTime = required(req.body, "eventStartDateTime", res);
        const eventEndDateTime = required(req.body, "eventEndDateTime", res);
        const location = required(req.body, "eventLocation", res);
        const information = required(req.body, "eventInformation", res);

        const eventCreatedLang = lang.event.eventCreated;

        try {
            db.query(`INSERT INTO events (name, icon, eventStartDateTime, eventEndDateTime, location, information) VALUES (?, ?, ?, ?, ?, ?)`, [name, icon, eventStartDateTime, eventEndDateTime, location, information], function(error, results, fields) {
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

        // Check if event exists
        let eventExists = await doesEventExist(eventId);
        if (!eventExists) {
            return res.send({
                success: false,
                message: `Event does not exist.`
            });
        }

        res.send({ success: true });
    });

    app.post(baseEndpoint + '/publish', async function(req, res) {
        isFeatureEnabled(features.events, res, lang);
        const eventId = required(req.body, "eventId", res);

        // Check if event exists
        let eventExists = await doesEventExist(eventId);
        if (!eventExists) {
            return res.send({
                success: false,
                message: `Event does not exist.`
            });
        }

        // Check if event has been published
        let eventPublished = await isEventPublished(eventId);
        if (eventPublished) {
            return res.send({
                success: false,
                message: `Event is already published, you cannot publish this again.`
            });
        }

        try {
            db.query(`SELECT * FROM events where eventId=? AND published=?; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId, `1`, eventId], function (error, results, fields) {
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
                    getEventInfo(eventId)
                        .then(eventInfo => {
                            // Create Discord Event using the Event Info
                            createDiscordEvent(eventInfo, client, res);
                            setEventAsPublished(eventId);
                        })
                        .catch(err => {
                            console.log(err);
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
            // Check if event exists
            let eventExists = await doesEventExist(eventId);
            if (!eventExists) {
                return res.send({
                    success: false,
                    message: `Event does not exist.`
                });
            } else {
                db.query(`DELETE FROM events WHERE eventId=?;`, [eventId], function (error, results, fields) {
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
            }

        } catch (error) {
            console.log(error);
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });
}