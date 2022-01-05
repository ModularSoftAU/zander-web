export default function rankApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/rank';

    app.get(baseEndpoint + '/get', async function(req, res) {
        try {
            db.query(`SELECT * FROM ranks ORDER BY priority ASC;`, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.get(baseEndpoint + '/user', async function(req, res) {
        // Note: One or more of these could be null.
        const username = req.query.username;
        const rank = req.query.rank;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
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
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The rank ${displayName} has been successfully created!`
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
        const rankSlug = req.body.rankSlug;
        const displayName = req.body.displayName;
        const priority = req.body.priority;
        const rankBadgeColour = req.body.rankBadgeColour;
        const rankTextColour = req.body.rankTextColour;
        const discordRoleId = req.body.discordRoleId;
        const isStaff = req.body.isStaff;
        const isDonator = req.body.isDonator;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const rankSlug = req.body.rankSlug;

        try {
            db.query(`DELETE FROM ranks WHERE rankSlug = ?;`, [rankSlug], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `Deletion of rank with the slug of ${rankSlug} has been successful`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/assign', async function(req, res) {
        const rankSlug = req.body.rankSlug;
        const username = req.body.username;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/unassign', async function(req, res) {
        const rankSlug = req.body.rankSlug;
        const username = req.body.username;

        // ...
        res.send({ success: true });
    });

}