import socialProfileStratagies from '../../socialProfileStratagies.json'
import passport from 'passport';

export default function userApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/user';

    app.post(baseEndpoint + '/create', async function(req, res) {
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
                    return res.send(`${username} (${uuid}) has been successfully created.`);
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

    app.post(baseEndpoint + '/profile/edit', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/about/update', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/twitter', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/twitch', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/youtube', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/instagram', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/steam', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/github', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/spotify', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    // 
    // Discord
    // 
    app.post(baseEndpoint + '/profile/authenticate/discord', async function(req, res) {
        const username = req.params.username;

        // res.send({ success: true });
    });

    app.post(baseEndpoint + '/setting/:settingOption', async function(req, res) {
        const settingOption = req.params.settingOption;
        // TODO

        // ...
        res.send({ success: true });
    });

}