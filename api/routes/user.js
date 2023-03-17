import {isFeatureEnabled, required, optional} from '../common'

export default function userApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/user';

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.web.login, res, features, lang);
        const uuid = required(req.body, "uuid", res);
        const username = required(req.body, "username", res);

        const userCreatedLang = lang.api.userCreated

        // shadowolf
        // Check if user does not exist, we do this in case of testing we create multiple users on accident
        db.query(`SELECT * FROM users WHERE uuid=?`, [uuid], function (error, results, fields) {
            if (error) {
                console.log(error);
            }

            if (results[0]) {
                // To ensure usernames are always accurate we set the username just in case the username changes.
                db.query(`UPDATE users SET username=? WHERE uuid=?;`, [username, uuid], function (error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }
                });

                // If the user already exists, we alert the console that the user wasn't created because it doesn't exist.
                return res.send({
                    success: null,
                    message: `${lang.api.userAlreadyExists}`
                });
            }

            // If user does not exist, create them
            db.query(`INSERT INTO users (uuid, username) VALUES (?, ?)`, [uuid, username], function (error, results, fields) {
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
    });

    // TODO: Update docs
    app.get(baseEndpoint + '/get', async function(req, res) {
        const username = required(req.query, "username");
        
        try {
            db.query(`SELECT * FROM users WHERE username=?;`, [username], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: error
                    });
                }
                
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

    // 
    // IP Check
    // Find all users that connected from a specific IP
    // 
    app.get(baseEndpoint + '/check/ip', async function(req, res) {
        isFeatureEnabled(features.moderation.ipCheck, res, features, lang);
        const ipAddress = required(req.query, "ipAddress");
        
        try {
            db.query(`SELECT u.userId, u.uuid, u.username, gs.ipAddress FROM gamesessions gs LEFT JOIN users u ON gs.userId = u.userId WHERE gs.ipAddress = ?`, [ipAddress], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: error
                    });
                }

                if (!results || !results.length) {
                    return res.send({
                        success: false,
                        message: `User has not logged in or IP address has not been used.`
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

    // 
    // Alt Check
    // Find all IP addresses a user has used to connect
    // 
    app.get(baseEndpoint + '/check/alts', async function(req, res) {
        isFeatureEnabled(features.moderation.altCheck, res, lang);
        const username = required(req.query, "username");
        
        try {
            db.query(`SELECT u.userId, u.uuid, u.username, gs.ipAddress FROM gamesessions gs LEFT JOIN users u ON gs.userId = u.userId WHERE u.username = ?;`, [username], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: error
                    });
                }

                if (!results || !results.length) {
                    return res.send({
                        success: false,
                        message: `User has not logged in or IP address has not been used.`
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

    // 
    // Profile Update
    // Update the specified users profile
    // 
    app.post(baseEndpoint + '/profile/update', async function (req, res) {
        isFeatureEnabled(features.web.profiles, res, lang);

        const userId = required(req.body, "userId");
        const profilePictureType = required(req.body, "profilePictureType");

        try {
            db.query(`UPDATE users SET profilePictureType=? WHERE userId=?;`, [profilePictureType, userId], function (error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: error
                    });
                }

                return res.send({
                    success: true,
                    alertType: "success",
                    alertContent: `Profile has been updated`
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