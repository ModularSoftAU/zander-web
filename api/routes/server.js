export default function serverApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/server';

    app.get(baseEndpoint + '/get', async function(req, res) {
        try {
            const visible = req.query.visible;

            function getServers(dbQuery) {
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
                            message: `There are currently no servers visible.`
                        });
                    }

                    return res.send({
                        success: true,
                        data: results
                    });
                });
            }

            if (!visible) {
                res.send({
                    success: false,
                    message: `You must select a visible indicator.`
                });
            }

            if (visible === 'true') {
                let dbQuery = `SELECT * FROM servers WHERE visible=1 ORDER BY position ASC;`
                getServers(dbQuery);
            }

            if (visible === 'false') {
                let dbQuery = `SELECT * FROM servers WHERE visible=0 ORDER BY position ASC;`
                getServers(dbQuery);
            }

            if (visible === 'all') {
                let dbQuery = `SELECT * FROM servers ORDER BY position ASC;`
                getServers(dbQuery);
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
        const fqdn = req.body.fqdn;
        const ipAddress = req.body.ipAddress;
        const port = req.body.port;
        const visible = req.body.visible;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO servers (name, fqdn, ipAddress, port, visible, position) VALUES (?, ?, ?, ?, ?)`, [name, fqdn, ipAddress, port, visible, position], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The server ${name} (${fqdn}) has been successfully created!`
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
        const serverId = req.body.serverId;
        const name = req.body.name;
        const fqdn = req.body.fqdn;
        const ipAddress = req.body.ipAddress;
        const port = req.body.port;
        const visible = req.body.visible;
        const position = req.body.position;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const serverId = req.body.serverId;

        try {
            db.query(`DELETE FROM servers WHERE serverId = ?;`, [serverId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `Deletion of server with the id ${serverId} has been successful`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

}