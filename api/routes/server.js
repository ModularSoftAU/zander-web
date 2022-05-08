import {isFeatureEnabled, required, optional} from '../common'

export default function serverApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/server';

    // TODO: Update docs
    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.servers, res, lang);
        const visible = optional(req.query, "visible");
        const id = optional(req.query, "id");

        try {

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

            // Get Server by ID
            if (id) {
                let dbQuery = `SELECT * FROM servers WHERE serverId=${id};`
                getServers(dbQuery);
            }

            // Get Servers that are publically visable
            if (visible === 'true') {
                let dbQuery = `SELECT * FROM servers WHERE visible=1 ORDER BY position ASC;`
                getServers(dbQuery);
            }

            // Get Servers that are not private or internal
            if (visible === 'false') {
                let dbQuery = `SELECT * FROM servers WHERE visible=0 ORDER BY position ASC;`
                getServers(dbQuery);
            }

            // Return all Servers by default
            let dbQuery = `SELECT * FROM servers ORDER BY position ASC;`
            getServers(dbQuery);

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.servers, res, lang);
        const name = required(req.body, "name", res);
        const fqdn = required(req.body, "fqdn", res);
        const ipAddress = required(req.body, "ipAddress", res);
        const port = required(req.body, "port", res);
        const visible = required(req.body, "visible", res);
        const position = required(req.body, "position", res);

        try {
            db.query(`INSERT INTO servers (name, fqdn, ipAddress, port, visible, position) VALUES (?, ?, ?, ?, ?, ?)`, [name, fqdn, ipAddress, port, visible, position], function(error, results, fields) {
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
        isFeatureEnabled(features.servers, res, lang);
        const serverId = required(req.body, "serverId", res);
        const name = required(req.body, "name", res);
        const fqdn = required(req.body, "fqdn", res);
        const ipAddress = required(req.body, "ipAddress", res);
        const port = required(req.body, "port", res);
        const visible = required(req.body, "visible", res);
        const position = required(req.body, "position", res);

        try {
            db.query(`UPDATE servers SET name=?, fqdn=?, ipAddress=?, port=?, visible=?, position=? WHERE serverId=?`, [name, fqdn, ipAddress, port, visible, position, serverId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The server with the ID of ${serverId} has been successfully updated!`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.servers, res, lang);
        const serverId = required(req.body, "serverId", res);

        try {
            db.query(`DELETE FROM servers WHERE serverId=?;`, [serverId], function(error, results, fields) {
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