import {isFeatureEnabled, required, optional} from '../common'

export default function reportApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/report';

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.report, res, lang);
        const reportId = optional(req.query, "reportId");
        const username = optional(req.query, "username");

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
        isFeatureEnabled(features.report, res, lang);
        const reportedUser = required(req.body, "reportedUser", res);
        const reporterUser = required(req.body, "reporterUser", res);
        const reason = required(req.body, "reason", res);
        const evidence = optional(req.body, "evidence");
        const server = required(req.body, "server", res);

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
        isFeatureEnabled(features.report, res, lang);
        const reportId = required(req.body, "reportId", res);

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