const baseEndpoint = config.siteConfiguration.apiRoute + '/session';

export default function sessionApiRoute(app, config, db) {

    app.post(baseEndpoint + '/create', async function(req, res) {
        const uuid = req.body.uuid;
        const ipAddress = req.body.ipAddress;
        const server = req.body.server;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/destroy', async function(req, res) {
        const uuid = req.body.uuid;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/swtich', async function(req, res) {
        const uuid = req.body.uuid;
        const server = req.body.server;

        // ...
        res.send({ success: true });
    });

}