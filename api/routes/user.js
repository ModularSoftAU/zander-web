import {isFeatureEnabled, required, optional} from '../common'

export default function userApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/user';

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.user, res, lang);
        const uuid = required(req.body, "uuid", res);
        const username = required(req.body, "username", res);

        const userCreatedLang = lang.api.userCreated

        try {
            // shadowolf
            // Check if user does not exist, we do this in case of testing we create multiple users on accident
            db.query(`SELECT * FROM users WHERE uuid=?`, [uuid], function(error, results, fields) {
                // If user exists, check that they haven't changed their username since their last login.
                // If they have we update it in the database, so the display name is accurate.
                if (results[0]) {
                    db.query(`UPDATE users SET username=? WHERE uuid=?;`, [username, uuid], function(error, results, fields) {
                        if (error) {
                            return res.send({
                                success: false,
                                message: `${error}`
                            });
                        }
                    });

                    // If the user already exists, we terminate the creation of the user
                    return res.send({
                        success: false,
                        message: lang.api.userAlreadyExists
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
                        message: userCreatedLang.replace('%USERNAME%', username).replace('%UUID%', uuid)
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
                        message: lang.api.userDoesNotExist
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
                        message: lang.api.noNotifications
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
                        message: lang.api.noNotifications
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