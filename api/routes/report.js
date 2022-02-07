export default function reportApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/report';

    app.get(baseEndpoint + '/get', async function(req, res) {
        const reportId = req.query.id;
        const username = req.query.username;

        // If the ?id= is used, search by ID instead.
        if (reportId) {
            try {
                db.query(`SELECT reportid, (SELECT username FROM users WHERE userID=reportedUserId) as 'reportedUser', (SELECT uuid FROM users WHERE userID=reportedUserId) as 'reportedUserUUID', (SELECT username FROM users WHERE userID=reporterUserId) as 'reporterUser', (SELECT uuid FROM users WHERE userID=reporterUserId) as 'reporterUserUUID', reason, evidence, (SELECT name FROM servers WHERE serverId=server) as 'reportedServer', createdDate, closed FROM reports WHERE reportId=?;`, [reportId], function(error, results, fields) {
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
        }

        // If the ?username= is used, search by username instead.
        if (reportId) {
            try {
                db.query(`SELECT reportid, (SELECT username FROM users WHERE userID=reportedUserId) as 'reportedUser', (SELECT uuid FROM users WHERE userID=reportedUserId) as 'reportedUserUUID', (SELECT username FROM users WHERE userID=reporterUserId) as 'reporterUser', (SELECT uuid FROM users WHERE userID=reporterUserId) as 'reporterUserUUID', reason, evidence, (SELECT name FROM servers WHERE serverId=server) as 'reportedServer', createdDate, closed FROM reports WHERE reportedUserId=(SELECT userId FROM users WHERE username=?);`, [username], function(error, results, fields) {
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
        }

        try {
            db.query(`SELECT reportid, (SELECT username FROM users WHERE userID=reportedUserId) as 'reportedUser', (SELECT uuid FROM users WHERE userID=reportedUserId) as 'reportedUserUUID', (SELECT username FROM users WHERE userID=reporterUserId) as 'reporterUser', (SELECT uuid FROM users WHERE userID=reporterUserId) as 'reporterUserUUID', reason, evidence, (SELECT name FROM servers WHERE serverId=server) as 'reportedServer', createdDate, closed FROM reports`, function(error, results, fields) {
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

    app.post(baseEndpoint + '/create', async function(req, res) {
        const reportedUser = req.body.reportedUser;
        const reporterUser = req.body.reporterUser;
        const reason = req.body.reason;
        const evidence = req.body.evidence;
        const server = req.body.server;

        try {
            db.query(`INSERT INTO reports (reportedUserId, reporterUserId, reason, evidence, server) VALUES ((SELECT userId FROM users WHERE username=?), (SELECT userId FROM users WHERE username=?), ?, ?, (SELECT serverId FROM servers WHERE name=?))`, [reportedUser, reporterUser, reason, evidence, server], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The report against ${reportedUser} has been successfully created!`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/close', async function(req, res) {
        const reportId = req.body.reportId;

        try {
            db.query(`UPDATE reports SET closed=? WHERE reportId=?`, [1, reportId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The report with the ID of ${reportId} has been successfully closed.`
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