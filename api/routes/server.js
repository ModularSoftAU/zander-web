import {isFeatureEnabled, required, optional, generateLog} from '../common'

export default function serverApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/server';

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
                            message: lang.server.noServers
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

    app.get(baseEndpoint + '/users/get', async function(req, res) {
        try {
            db.query(`
                SELECT
                    s.name,
                    c.playersOnline
                FROM servers s
                RIGHT JOIN (
                    SELECT
                        COUNT(serverId) AS playersOnline,
                        serverId
                    FROM gamesessions
                    WHERE sessionEnd IS NULL
                        OR sessionEnd > NOW()
                    GROUP BY serverId
                ) c ON s.serverId = c.serverId
            `, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results.length) {
                    return res.send({
                        success: false,
                        message: `There are no users online.`
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

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.servers, res, lang);

        const actioningUser = required(req.body, "actioningUser", res);
        const name = required(req.body, "name", res);
        const fqdn = required(req.body, "fqdn", res);
        const ipAddress = required(req.body, "ipAddress", res);
        const port = required(req.body, "port", res);
        const visible = required(req.body, "visible", res);
        const position = required(req.body, "position", res);

        const serverCreatedLang = lang.server.serverCreated

        try {
            db.query(`
                INSERT INTO 
                    servers
                (
                    name, 
                    fqdn, 
                    ipAddress, 
                    port, 
                    visible, 
                    position
                ) VALUES (?, ?, ?, ?, ?, ?)`, [name, fqdn, ipAddress, port, visible, position], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                generateLog(actioningUser, "SUCCESS", "SERVER", `Created ${name} (${fqdn})`, res);
                
                return res.send({
                    success: true,
                    message: serverCreatedLang.replace("%NAME%", name)
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

        const actioningUser = required(req.body, "actioningUser", res);
        const serverId = required(req.body, "serverId", res);
        const name = required(req.body, "name", res);
        const fqdn = required(req.body, "fqdn", res);
        const ipAddress = required(req.body, "ipAddress", res);
        const port = required(req.body, "port", res);
        const visible = required(req.body, "visible", res);
        const position = required(req.body, "position", res);

        try {
            db.query(`
            UPDATE 
                servers 
            SET 
                name=?, 
                fqdn=?, 
                ipAddress=?, 
                port=?, 
                visible=?, 
                position=? 
            WHERE 
                serverId=?`, 
            [
                name, 
                fqdn, 
                ipAddress, 
                port, 
                visible, 
                position, 
                serverId
            ], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                generateLog(actioningUser, "SUCCESS", "SERVER", `Edited ${name} (${fqdn})`, res);

                return res.send({
                    success: true,
                    message: lang.server.serverEdited
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

        const actioningUser = required(req.body, "actioningUser", res);
        const serverId = required(req.body, "serverId", res);

        try {
            db.query(`DELETE FROM servers WHERE serverId=?;`, [serverId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                generateLog(actioningUser, "SUCCESS", "SERVER", `Deleted ${serverId}`, res);

                return res.send({
                    success: true,
                    message: lang.server.serverDeleted
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