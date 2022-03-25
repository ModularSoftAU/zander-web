export default function userApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/user';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (features.user == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const uuid = req.body.uuid;
        const username = req.body.username;

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

    app.get(baseEndpoint + '/get', async function(req, res) {
        if (features.user == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.query.username;
        
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

    app.post(baseEndpoint + '/profile/:username/edit', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/about/update', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/authenticate/twitter', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/authenticate/twitch', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/authenticate/youtube', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/authenticate/instagram', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/authenticate/steam', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/authenticate/github', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/authenticate/spotify', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/:username/authenticate/discord', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/setting/:settingOption', async function(req, res) {
        if (features.userProfiles == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const settingOption = req.params.settingOption;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/notification/get', async function(req, res) {
        if (features.user == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

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

    app.post(baseEndpoint + '/notification/create', async function(req, res) {
        if (features.user == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.body.username;
        const body = req.body.body;
        const link = req.body.link;
        const icon = req.body.icon;

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