export default function reportApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/report';

    app.get(baseEndpoint + '/get', async function(req, res) {
        if (features.report == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const reportId = req.query.id;
        const username = req.query.username;

        // If the ?reportId= is used, search by ID instead.
        if (reportId) {
            try {
                db.query(`
					SELECT r.reportId
						,reported.username AS 'reportedUser'
						,reported.uuid AS 'reportedUserUUID'
						,reporter.username AS 'reporterUser'
						,reporter.uuid AS 'reporterUserUUID'
						,reason
						,evidence
						,name AS 'reportedServer'
						,createdDate
						,closed
					FROM reports r
						LEFT JOIN users reported ON reported.userId = r.reportedUserId
						LEFT JOIN users reporter ON reporter.userId = r.reporterUserId
						LEFT JOIN servers s ON r.server = s.serverId
					WHERE r.reportId = ?;
				`, [reportId], function(error, results, fields) {
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
        if (username) {
            try {
                db.query(`
					SELECT r.reportId
						,reported.username AS 'reportedUser'
						,reported.uuid AS 'reportedUserUUID'
						,reporter.username AS 'reporterUser'
						,reporter.uuid AS 'reporterUserUUID'
						,reason
						,evidence
						,name AS 'reportedServer'
						,createdDate
						,closed
					FROM reports r
						LEFT JOIN users reported ON reported.userId = r.reportedUserId
						LEFT JOIN users reporter ON reporter.userId = r.reporterUserId
						LEFT JOIN servers s ON r.server = s.serverId
					WHERE reported.username = ?;
				`, [username], function(error, results, fields) {
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
            db.query(`
				SELECT r.reportId
					,reported.username AS 'reportedUser'
					,reported.uuid AS 'reportedUserUUID'
					,reporter.username AS 'reporterUser'
					,reporter.uuid AS 'reporterUserUUID'
					,reason
					,evidence
					,name AS 'reportedServer'
					,createdDate
					,closed
				FROM reports r
					LEFT JOIN users reported ON reported.userId = r.reportedUserId
					LEFT JOIN users reporter ON reporter.userId = r.reporterUserId
					LEFT JOIN servers s ON r.server = s.serverId;
			`, function(error, results, fields) {
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
        if (features.report == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

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
        if (features.report == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

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