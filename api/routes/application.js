import {isFeatureEnabled, required, optional} from '../common'

export default function applicationApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/application';

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.applications, res, features, lang);
        const id = optional(req.query, "id");

        try {
            function getApplications(dbQuery) {
                db.query(dbQuery, function(error, results, fields) {
                    if (error) {
                        res.send({
                            success: false,
                            message: `${error}`
                        });
                    }

                    if (!results.length) {
                        return res.send({
                            success: false,
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
				message: `${error}`
			});
        }
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.applications, res, features, lang);
        const displayName = required(req.body, "displayName", res);
        const description = required(req.body, "description", res);
        const displayIcon = required(req.body, "displayIcon", res);
        const requirementsMarkdown = required(req.body, "requirementsMarkdown", res);
        const redirectUrl = required(req.body, "redirectUrl", res);
        const position = required(req.body, "position", res);
        const applicationStatus = required(req.body, "closed", res);

        let applicationCreatedLang = lang.applications.applicationCreated;

        try {
            db.query(`
                INSERT INTO applications 
                    (displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position, closed) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [displayName, description, displayIcon, requirementsMarkdown, redirectUrl, position, applicationStatus], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: applicationCreatedLang.replace("%DISPLAYNAME%", displayName)
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
        isFeatureEnabled(features.applications, res, features, lang);
        const applicationId = required(req.body, "applicationId", res);
        const displayName = required(req.body, "displayName", res);
        const description = required(req.body, "description", res);
        const displayIcon = required(req.body, "displayIcon", res);
        const requirementsMarkdown = required(req.body, "requirementsMarkdown", res);
        const redirectUrl = required(req.body, "redirectUrl", res);
        const position = required(req.body, "position", res);
        const applicationStatus = required(req.body, "closed", res);

        let applicationEditedLang = lang.applications.applicationEdited;

        console.log(req.body);
		
		try {
			db.query(`
                UPDATE 
                    applications 
                SET 
                    displayName=?, 
                    displayIcon=?, 
                    description=?, 
                    requirementsMarkdown=?, 
                    redirectUrl=?, 
                    position=?,
                    closed=?
                WHERE applicationId=?;`,
                [displayName, displayIcon, description, requirementsMarkdown, redirectUrl, position, applicationStatus, applicationId], function(error, results, fields) {
				if (error) {
					return res.send({
						success: false,
						message: `${error}`
					});
				}
				return res.send({
					success: true,
					message: applicationEditedLang.replace("%DISPLAYNAME%", displayName)
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
        isFeatureEnabled(features.applications, res, features, lang);
        const applicationId = required(req.body, "applicationId", res);

        console.log(applicationId);

        try {
            db.query(`DELETE FROM applications WHERE applicationId=?;`, [applicationId], function(error, results, fields) {
                if (error) {
                    res.send({
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