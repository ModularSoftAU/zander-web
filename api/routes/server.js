import {isFeatureEnabled, required, optional, generateLog} from '../common'

export default function serverApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/server';

    // TODO: Update docs
    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.servers, res, lang);
        const serverId = optional(req.query, "serverId");

        try {
            function getServers(dbQuery) {
                db.query(dbQuery, function(error, results, fields) {
                    if (error) {
                        res.send({
                            success: false,
                            message: `${error}`
                        });
                    }

                    if (!results.length) {
                        res.send({
                            success: false,
                            message: lang.server.noServers
                        });
                    }

                    res.send({
                        success: true,
                        data: results
                    });
                });
            }

            // Get Server by ID
            if (serverId) {
                let dbQuery = `SELECT * FROM servers WHERE serverId=${serverId};`
                getServers(dbQuery);
            }

            // Return all Servers by default
            let dbQuery = `SELECT * FROM servers ORDER BY position ASC;`
            getServers(dbQuery);
            return res;
        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }

        return res;
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
            return res.send({
                success: false,
                message: `${error}`
            });
        }
        
        return res;
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.servers, res, lang);

        const actioningUser = required(req.body, "actioningUser", res);
        const displayName = required(req.body, "displayName", res);
        const serverConnectionAddress = required(req.body, "serverConnectionAddress", res);
        const position = required(req.body, "position", res);

        const serverCreatedLang = lang.server.serverCreated

        try {
            db.query(`
                INSERT INTO 
                    servers
                (
                    displayName, 
                    serverConnectionAddress,
                    position
                ) VALUES (?, ?, ?)`, [displayName, serverConnectionAddress, position], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                generateLog(actioningUser, "SUCCESS", "SERVER", `Created ${displayName} (${serverConnectionAddress})`, res);
                
                return res.send({
                    success: true,
                    message: serverCreatedLang.replace("%NAME%", displayName)
                });
            });

        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }

        return res;
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        isFeatureEnabled(features.servers, res, lang);

        const actioningUser = required(req.body, "actioningUser", res);
        const serverId = required(req.body, "serverId", res);
        const displayName = required(req.body, "displayName", res);
        const serverConnectionAddress = required(req.body, "serverConnectionAddress", res);
        const position = required(req.body, "position", res);

        try {
            db.query(`
            UPDATE 
                servers 
            SET 
                displayName=?, 
                serverConnectionAddress=?, 
                ipAddress=?, 
                port=?, 
                position=? 
            WHERE 
                serverId=?`, 
            [
                displayName, 
                serverConnectionAddress, 
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

                generateLog(actioningUser, "SUCCESS", "SERVER", `Edited ${displayName} (${serverConnectionAddress})`, res);

                return res.send({
                    success: true,
                    message: lang.server.serverEdited
                });
            });

        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }

        return res;
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
            return res.send({
                success: false,
                message: `${error}`
            });
        }

        return res;
    });
}