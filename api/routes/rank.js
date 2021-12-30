const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/rank";

module.exports = (app) => {

    app.get(baseEndpoint + '/get', (req, res, next) => {
        try {
            db.query(`SELECT * FROM ranks ORDER BY priority ASC;`, function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.get(baseEndpoint + '/user', (req, res, next) => {
        // Note: One or more of these could be null.
        const username = req.query.username;
        const rank = req.query.rank;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const rankSlug = req.body.rankSlug;
        const displayName = req.body.displayName;
        const priority = req.body.priority;
        const rankBadgeColour = req.body.rankBadgeColour;
        const rankTextColour = req.body.rankTextColour;
        const discordRoleId = req.body.discordRoleId;
        const isStaff = req.body.isStaff;
        const isDonator = req.body.isDonator;

        try {
            db.query(`INSERT INTO ranks (rankSlug, displayName, priority, rankBadgeColour, rankTextColour, discordRoleId, isStaff, isDonator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [rankSlug, displayName, priority, rankBadgeColour, rankTextColour, discordRoleId, isStaff, isDonator], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The rank ${displayName} has been successfully created!`
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
        const rankSlug = req.body.rankSlug;
        const displayName = req.body.displayName;
        const priority = req.body.priority;
        const rankBadgeColour = req.body.rankBadgeColour;
        const rankTextColour = req.body.rankTextColour;
        const discordRoleId = req.body.discordRoleId;
        const isStaff = req.body.isStaff;
        const isDonator = req.body.isDonator;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/delete', (req, res, next) => {
        const rankSlug = req.body.rankSlug;

        try {
            db.query(`DELETE FROM ranks WHERE rankSlug = ?;`, [rankSlug], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `Deletion of rank with the slug of ${rankSlug} has been successful`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/assign', (req, res, next) => {
        const rankSlug = req.body.rankSlug;
        const username = req.body.username;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/unassign', (req, res, next) => {
        const rankSlug = req.body.rankSlug;
        const username = req.body.username;

        // ...
        res.json({ success: true });
    });

}