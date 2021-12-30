const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/event";

module.exports = (app) => {

    app.get(baseEndpoint + '/get', (req, res, next) => {
        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const name = req.body.name;
        const icon = req.body.icon;
        const eventDateTime = req.body.eventDateTime;
        const hostingServer = req.body.hostingServer;
        const information = req.body.information;

        try {
            db.query(`INSERT INTO events (name, icon, eventDateTime, hostingServer, information) VALUES (?, ?, ?, (select serverId from servers where name=?), ?)`, [name, icon, eventDateTime, hostingServer, information], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The event ${name} has been successfully created!`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/edit', (req, res, next) => {
        const eventId = req.body.eventId;
        const name = req.body.name;
        const icon = req.body.icon;
        const eventDateTime = req.body.eventDateTime;
        const hostingServer = req.body.hostingServer;
        const information = req.body.information;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/delete', (req, res, next) => {
        const eventId = req.body.eventId;

        try {
            db.query(`DELETE FROM events WHERE eventId=?`, [eventId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The event with the id of ${eventId} has been successfully deleted.`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/publish', (req, res, next) => {
        const eventId = req.body.eventId;

        try {
            db.query(`UPDATE events SET published=? WHERE eventId=?`, [`1`, eventId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The event with the id of ${eventId} has been successfully published.`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

}