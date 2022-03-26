import {isFeatureEnabled, required, optional} from '../common'

export default function userApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/user';

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.user, res, lang);
        const uuid = required(req.body, "uuid", res);
        const username = required(req.body, "username", res);

        try {
            // shadowolf
            // Check if user does not exist, we do this in case of testing we create multiple users on accident
            db.query(`SELECT * FROM users WHERE uuid=?`, [uuid], function(error, results, fields) {
                if (results[0]) {
                    return res.send({
                        success: false,
                        message: `This user already exists (somehow), terminating creation.`
                    });
                }

                // If user does not exist, create them
                db.query(`INSERT INTO users (uuid, username) VALUES (?, ?)`, [uuid, username], function(error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }
                    return res.send({
                        success: true,
                        message: `${username} (${uuid}) has been successfully created.`
                    });
                });
            });
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    // TODO: Update docs
    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.user, res, lang);
        const username = optional(req.query, "username");
        
        try {
            db.query(`SELECT * FROM users WHERE uuid=(SELECT uuid FROM users WHERE username=?);`, [username], function(error, results, fields) {
                if (!results || !results.length) {
                    return res.send({
                        success: false,
                        message: `This user does not exist.`
                    });
                }
                
                res.send({
                    success: true,
                    data: results
                });
            });
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    // TODO: Update docs
    app.get(baseEndpoint + '/notification/get', async function(req, res) {
        isFeatureEnabled(features.user, res, lang);
        const username = req.session.user;
        
        try {
            db.query(`SELECT * FROM notifications WHERE userId=(SELECT userId FROM users WHERE username=?);`, [username], function(error, results, fields) {
                if (!results || !results.length) {
                    return res.send({
                        success: false,
                        message: `You do not have any notifications.`
                    });
                }
                
                res.send({
                    success: true,
                    data: results
                });
            });
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    // TODO: Update docs
    app.post(baseEndpoint + '/notification/create', async function(req, res) {
        isFeatureEnabled(features.user, res, lang);
        const username = required(req.body, "username", res);
        const body = required(req.body, "body", res);
        const link = required(req.body, "link", res);
        const icon = required(req.body, "icon", res);

        try {
            db.query(`INSERT INTO`, [username], function(error, results, fields) {
                if (!results || !results.length) {
                    return res.send({
                        success: false,
                        message: `You do not have any notifications.`
                    });
                }
                
                res.send({
                    success: true,
                    data: results
                });
            });
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }        
    });

}