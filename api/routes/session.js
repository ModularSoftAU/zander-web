import config from '../../config.json'
const baseEndpoint = config.siteConfiguration.apiRoute + "/session";

export default function sessionApiRoute(app) {

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const uuid = req.body.uuid;
        const ipAddress = req.body.ipAddress;
        const server = req.body.server;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/destroy', (req, res, next) => {
        const uuid = req.body.uuid;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/swtich', (req, res, next) => {
        const uuid = req.body.uuid;
        const server = req.body.server;

        // ...
        res.json({ success: true });
    });

}
