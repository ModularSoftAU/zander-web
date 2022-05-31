import {isFeatureEnabled, required, optional} from '../common'

export default function applicationApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/application';

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.applications, res, lang);
        const id = optional(req.query, "id");

        try {
            function getApplications(dbQuery) {
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
                            message: `There are currently no applications.`
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
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.applications, res, lang);
        const displayName = required(req.body, "displayName", res);
        const description = required(req.body, "description", res);
        const displayIcon = required(req.body, "displayIcon", res);
        const requirementsMarkdown = required(req.body, "requirementsMarkdown", res);
        const redirectUrl = required(req.body, "redirectUrl", res);
        const position = required(req.body, "position", res);

        try {
            db.query(`INSERT INTO applications (displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position) VALUES (?, ?, ?, ?, ?, ?)`, [displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The application ${displayName} has been successfully created!`
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
        isFeatureEnabled(features.applications, res, lang);
        const applicationId = required(req.body, "applicationId", res);
        const displayName = required(req.body, "displayName", res);
        const description = required(req.body, "description", res);
        const displayIcon = required(req.body, "displayIcon", res);
        const requirementsMarkdown = required(req.body, "requirementsMarkdown", res);
        const redirectUrl = required(req.body, "redirectUrl", res);
        const position = required(req.body, "position", res);
		
		try {
			db.query(`UPDATE applications SET displayName = ?, description = ?, displayIcon = ?, requirementsMarkdown = ?, redirectUrl = ?, position = ? WHERE applicationId = ?`, [displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position, applicationId], function(error, results, fields) {
				if (error) {
					return res.send({
						success: false,
						message: `${error}`
					});
				}
				return res.send({
					success: true,
					message: `The application ${displayName} has been successfully updated!`
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
        isFeatureEnabled(features.applications, res, lang);
        const applicationId = required(req.body, "applicationId", res);

        try {
            db.query(`DELETE FROM applications WHERE applicationId = ?;`, [applicationId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
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
                message: `${error}`
            });
        }
    });

}