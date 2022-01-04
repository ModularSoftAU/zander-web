import config from '../../config.json'
const baseEndpoint = config.siteConfiguration.apiRoute + "/friend";

export default function friendApiRoute(app) {

    app.post(baseEndpoint + '/request', async function(req, res) {
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/accept', async function(req, res) {
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;
        const action = req.body.action;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deny', async function(req, res) {
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;
        const action = req.body.action;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/block', async function(req, res) {
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;
        const action = req.body.action;

        // ...
        res.send({ success: true });
    });

}