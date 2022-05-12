import {isFeatureEnabled, required, optional} from '../common'

export default function sessionApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/session';

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);
        const ipAddress = required(req.body, "ipAddress", res);
        const server = required(req.body, "server", res);

        try {
            // Insert newly started session into database
            db.query(`
                INSERT INTO gameSessions 
                    (
                        userId, 
                        ipAddress, 
                        serverId
                    ) VALUES (
                        (SELECT userId FROM users WHERE uuid=?), 
                        ?,
                        (SELECT serverId FROM servers WHERE name=?)
                    )`, [uuid, ipAddress, server], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: `New session for ${uuid} has been created.`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }

    });

    app.post(baseEndpoint + '/destroy', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);

        try {
            // Update any open sessions for the specified user to close them
			// The 'AND gameSessions.sessionId > 0' line is necessary to bypass mySQL's "safe update" feature.
			// If this is not there and there is somehow more than 1 open session, the query will fail.
            db.query(`
                UPDATE gameSessions, users
					SET gameSessions.sessionEnd = NOW()
				WHERE gameSessions.userId = users.userId
					AND users.uuid = ?
					AND gameSessions.sessionEnd IS NULL
					AND gameSessions.sessionId > 0
				`, [uuid], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: `All sessions for ${uuid} has been closed.`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }

    });

    app.post(baseEndpoint + '/switch', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);
        const server = required(req.body, "server", res);

        try {
            // Update any open sessions for the specified user to change to the specified server
			// The 'AND gameSessions.sessionId > 0' line is necessary to bypass mySQL's "safe update" feature.
			// If this is not there and there is somehow more than 1 open session, the query will fail.
            db.query(`
                UPDATE gameSessions, users, servers
					SET gameSessions.serverId = servers.serverId
				WHERE gameSessions.userId = users.userId
					AND users.uuid = ?
					AND gameSessions.sessionEnd IS NULL
					AND servers.name = ?
					AND gameSessions.sessionId > 0
				`, [uuid, server], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: `${uuid} has switched server to ${server}.`
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