const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/server";

module.exports = (app) => {

    app.get(baseEndpoint + '/get', (req, res, next) => {
        try {
            const visability = req.query.visability;

            function getServers(dbQuery) {
                db.query(dbQuery, function(error, results, fields) {
                    if (error) {
                        return res.json({
                            success: false,
                            message: `${error}`
                        });
                    }

                    if (!results.length) {
                        return res.json({
                            success: false,
                            message: `There are currently no servers visable.`
                        });
                    }

                    return res.json({
                        success: true,
                        data: results
                    });
                });
            }

            if (!visability) {
                res.json({
                    success: false,
                    message: `You must select a visability indicator.`
                });                
            }

            if (visability === 'true') {
                let dbQuery = `SELECT * FROM servers WHERE visable=1 ORDER BY position ASC;`
                getServers(dbQuery);
            }

            if (visability === 'false') {
                let dbQuery = `SELECT * FROM servers WHERE visable=0 ORDER BY position ASC;`
                getServers(dbQuery);
            }

            if (visability === 'all') {
                let dbQuery = `SELECT * FROM servers ORDER BY position ASC;`
                getServers(dbQuery);
            }

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const name = req.body.name;
        const fqdn = req.body.fqdn;
        const ipAddress = req.body.ipAddress;
        const port = req.body.port;
        const visible = req.body.visible;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO servers (name, fqdn, ipAddress, port, visible, position) VALUES (?, ?, ?, ?, ?)`, [name, fqdn, ipAddress, port, visible, position], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The server ${name} (${fqdn}) has been successfully created!`
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
        const serverId = req.body.serverId;
        const name = req.body.name;
        const fqdn = req.body.fqdn;
        const ipAddress = req.body.ipAddress;
        const port = req.body.port;
        const visability = req.body.visability;
        const position = req.body.position;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/delete', (req, res, next) => {
        const serverId = req.body.serverId;

        try {
            db.query(`DELETE FROM servers WHERE serverId = ?;`, [serverId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `Deletion of server with the id ${serverId} has been successful`
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
