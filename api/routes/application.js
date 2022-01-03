const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/application";

export default function applicationApiRoute(app) {

    app.get(baseEndpoint + '/get', (req, res, next) => {
        try {
            db.query(`SELECT * FROM applications ORDER BY position ASC;`, function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const displayName = req.body.displayName;
        const description = req.body.description;
        const displayIcon = req.body.displayIcon;
        const requirementsMarkdown = req.body.requirementsMarkdown;
        const redirectURL = req.body.redirectURL;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO applications (displayName, description, displayIcon, requirementsMarkdown, redirectURL, position) VALUES (?, ?, ?, ?, ?, ?)`, [displayName, description, displayIcon, requirementsMarkdown, redirectURL, position], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The application ${displayName} has been successfully created!`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/edit', (req, res, next) => {
        const applicationId = req.body.applicationId;
        const displayName = req.body.displayName;
        const description = req.body.description;
        const displayIcon = req.body.displayIcon;
        const requirementsMarkdown = req.body.requirementsMarkdown;
        const redirectURL = req.body.redirectURL;
        const position = req.body.position;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/delete', (req, res, next) => {
        const applicationId = req.body.applicationId;

        try {
            db.query(`DELETE FROM applications WHERE applicationId = ?;`, [applicationId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `Deletion of application with the id ${applicationId} has been successful`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

}
