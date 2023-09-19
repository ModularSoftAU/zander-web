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
        const username = optional(req.query, "username");
        const fetchAll = optional(req.query, "fetchAll");
        
        try {
            if (fetchAll) {
                db.query(`SELECT * FROM users;`, function (error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: error
                        });
                    }

                    console.log(results);

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
            } else {
                db.query(`SELECT * FROM users WHERE username=?;`, [username], function (error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: error
                        });
                    }

                    console.log(results);

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
            }
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }
    });
}