import {isFeatureEnabled, required, optional} from '../common'

export default function applicationApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/application';
    const baseRedirect = config.siteConfiguration.apiRoute + '/dashboard/applications'

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.application, res, lang);
        const id = optional(req.query, "id");

        try {
            function getApplications(dbQuery) {
                db.query(dbQuery, function(error, results, fields) {
                    if (error) {
                        res.send({
                            success: false,
                            redirectUrl: baseRedirect,
                            messageType: `alert-danger`,
                            message: `${error}`
                        });
                    }

                    if (!results.length) {
                        return res.send({
                            success: false,
                            redirectUrl: baseRedirect,
                            messageType: `alert-danger`,
                            message: lang.applications.noApplicationsFound
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
                let dbQuery = `SELECT * FROM applications WHERE applicationId=${id};`
                getApplications(dbQuery);
            }

            // Return all Servers by default
            let dbQuery = `SELECT * FROM applications ORDER BY position ASC;`
            getApplications(dbQuery);

        } catch (error) {
            res.send({
				success: false,
                redirectUrl: baseRedirect,
                messageType: `alert-danger`,
				message: `${error}`
			});
        }
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.application, res, lang);
        const displayName = required(req.body, "displayName", res);
        const description = required(req.body, "description", res);
        const displayIcon = required(req.body, "displayIcon", res);
        const requirementsMarkdown = required(req.body, "requirementsMarkdown", res);
        const redirectUrl = required(req.body, "redirectUrl", res);
        const position = required(req.body, "position", res);

        let applicationCreatedLang = lang.applications.applicationCreated;

        try {
            db.query(`INSERT INTO applications (displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position) VALUES (?, ?, ?, ?, ?, ?)`, [displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        redirectUrl: baseRedirect,
                        messageType: `alert-danger`,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    redirectUrl: baseRedirect,
                    messageType: `alert-success`,
                    message: applicationCreatedLang.replace("%DISPLAYNAME%", displayName)
                });
            });

        } catch (error) {
            res.send({
                success: false,
                redirectUrl: baseRedirect,
                messageType: `alert-danger`,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        isFeatureEnabled(features.applications, res, lang);
        const applicationId = required(req.body, "applicationId", res);
        const displayName = required(req.body, "displayName", res);
        const description = required(req.body, "description", res);
        const displayIcon = required(req.body, "displayIcon", res);
        const requirementsMarkdown = required(req.body, "requirementsMarkdown", res);
        const redirectUrl = required(req.body, "redirectUrl", res);
        const position = required(req.body, "position", res);

        let applicationEditedLang = lang.applications.applicationEdited;
		
		try {
			db.query(`UPDATE applications SET displayName = ?, description = ?, displayIcon = ?, requirementsMarkdown = ?, redirectUrl = ?, position = ? WHERE applicationId = ?`, [displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position, applicationId], function(error, results, fields) {
				if (error) {
					return res.send({
						success: false,
                        redirectUrl: baseRedirect,
                        messageType: `alert-danger`,
						message: `${error}`
					});
				}
				return res.send({
					success: true,
                    redirectUrl: ``,
                    messageType: ``,
					message: applicationEditedLang.replace("%DISPLAYNAME%", displayName)
				});
			});
		} catch (error) {
			res.send({
				success: false,
                redirectUrl: baseRedirect,
                messageType: `alert-danger`,
				message: `${error}`
			});
		}
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.applications, res, lang);
        const applicationId = required(req.body, "applicationId", res);

        try {
            db.query(`DELETE FROM applications WHERE applicationId = ?;`, [applicationId], function(error, results, fields) {
                if (error) {
                    res.send({
                        success: false,
                        redirectUrl: baseRedirect,
                        messageType: `alert-danger`,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `Deletion of application with the id ${applicationId} has been successful`
                });
            });

        } catch (error) {
            res.send({
				success: false,
                redirectUrl: baseRedirect,
                messageType: `alert-danger`,
				message: `${error}`
			});
        }
    });

}