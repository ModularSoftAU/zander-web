import {isFeatureEnabled, required, optional} from '../common'

export default function sessionApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/session';

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);
        const ipAddress = required(req.body, "ipAddress", res);
        const server = required(req.body, "server", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/destroy', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/switch', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);
        const server = required(req.body, "server", res);

        // ...
        res.send({ success: true });
    });

}