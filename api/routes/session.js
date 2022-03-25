export default function sessionApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/session';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (features.sessions == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const uuid = req.body.uuid;
        const ipAddress = req.body.ipAddress;
        const server = req.body.server;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/destroy', async function(req, res) {
        if (features.sessions == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const uuid = req.body.uuid;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/switch', async function(req, res) {
        if (features.sessions == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const uuid = req.body.uuid;
        const server = req.body.server;

        // ...
        res.send({ success: true });
    });

}