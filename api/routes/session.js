import {required} from '../common'

export default function sessionApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/session';

    app.post(baseEndpoint + '/create', async function(req, res) {
        const uuid = required(req.body, "uuid", res);
        const ipAddress = required(req.body, "ipAddress", res);
        
        const newSessionCreatedLang = lang.session.newSessionCreated

        try {
            // Insert newly started session into database
            db.query(`
                INSERT INTO gameSessions 
                    (
                        userId, 
                        ipAddress
                    ) VALUES (
                        (SELECT userId FROM users WHERE uuid=?), 
                        ?
                    )`, [uuid, ipAddress], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: newSessionCreatedLang.replace("%UUID%", uuid)
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
        
        return res;
    });

    app.post(baseEndpoint + '/destroy', async function(req, res) {
        const uuid = required(req.body, "uuid", res);

        const sessionClosedLang = lang.session.allSessionsClosed

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
                    message: sessionClosedLang.replace("%UUID%", uuid)
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }

        return res;
    });

    app.post(baseEndpoint + '/switch', async function(req, res) {
        const uuid = required(req.body, "uuid", res);
        const server = required(req.body, "server", res);

        const sessionSwitchLang = lang.session.sessionSwitch

        try {
            // Update any open sessions for the specified user to change to the specified server
			// The 'AND gameSessions.sessionId > 0' line is necessary to bypass mySQL's "safe update" feature.
			// If this is not there and there is somehow more than 1 open session, the query will fail.
            db.query(`
                UPDATE gameSessions, users, servers
					SET gameSessions.server = ?
				WHERE gameSessions.userId = users.userId
					AND users.uuid = ?
					AND gameSessions.sessionEnd IS NULL
					AND gameSessions.sessionId > 0
				`, [server, uuid], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: sessionSwitchLang.replace("%UUID%", uuid).replace("%SERVER%", server)
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }

        return res;
    });

}