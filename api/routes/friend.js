import {isFeatureEnabled, required, optional} from '../common'

export default function friendApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/friend';

    // TODO: Update docs
    app.post(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.friends, res, lang);
        const username = optional(req.query, "username");

        try {
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
        isFeatureEnabled(features.friends, res, lang);
        const requestee = required(req.body, "requestee", res);
        const requestedUser = required(req.body, "requestedUser", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/accept', async function(req, res) {
        isFeatureEnabled(features.friends, res, lang);
        const requestee = required(req.body, "requestee", res);
        const requestedUser = required(req.body, "requestedUser", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deny', async function(req, res) {
        isFeatureEnabled(features.friends, res, lang);
        const requestee = required(req.body, "requestee", res);
        const requestedUser = required(req.body, "requestedUser", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/remove', async function(req, res) {
        isFeatureEnabled(features.friends, res, lang);
        const requestee = required(req.body, "requestee", res);
        const requestedUser = required(req.body, "requestedUser", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/block', async function(req, res) {
        isFeatureEnabled(features.friends, res, lang);
        const requestee = required(req.body, "requestee", res);
        const requestedUser = required(req.body, "requestedUser", res);

        // ...
        res.send({ success: true });
    });

}