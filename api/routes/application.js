export default function applicationApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/application';

    app.get(baseEndpoint + '/get', async function(req, res) {
        try {
            db.query(`SELECT * FROM applications ORDER BY position ASC;`, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                // Send error is there are no applications.
                if (!results.length) {
                    return res.send({
                        success: false,
                        message: `There are no applications visable.`
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
        const displayName = req.body.displayName;
        const description = req.body.description;
        const displayIcon = req.body.displayIcon;
        const requirementsMarkdown = req.body.requirementsMarkdown;
        const redirectURL = req.body.redirectURL;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO applications (displayName, description, displayIcon, requirementsMarkdown, redirectURL, position) VALUES (?, ?, ?, ?, ?, ?)`, [displayName, description, displayIcon, requirementsMarkdown, redirectURL, position], function(error, results, fields) {
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
        const applicationId = req.body.applicationId;
        const displayName = req.body.displayName;
        const description = req.body.description;
        const displayIcon = req.body.displayIcon;
        const requirementsMarkdown = req.body.requirementsMarkdown;
        const redirectURL = req.body.redirectURL;
        const position = req.body.position;
		
		try {
			db.query(`UPDATE applications SET displayName = ?, description = ?, displayIcon = ?, requirementsMarkdown = ?, redirectURL = ?, position = ? WHERE applicationId = ?`, [displayName, description, displayIcon, requirementsMarkdown, redirectURL, position, applicationId], function(error, results, fields) {
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
        const applicationId = req.body.applicationId;

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