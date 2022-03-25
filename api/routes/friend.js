export default function friendApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/friend';

    app.post(baseEndpoint + '/get', async function(req, res) {
        if (features.friends == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        try {
            const username = req.query.username;

            db.query(`SELECT * FROM events WHERE published=1 ORDER BY eventDateTime ASC;`, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results.length) {
                    return res.send({
                        success: false,
                        message: `You have no friends.`
                    });
                }

                res.send({
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

    app.post(baseEndpoint + '/request', async function(req, res) {
        if (features.friends == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/accept', async function(req, res) {
        if (features.friends == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deny', async function(req, res) {
        if (features.friends == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/block', async function(req, res) {
        if (features.friends == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }
        
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;

        // ...
        res.send({ success: true });
    });

}