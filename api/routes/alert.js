import config from '../../config.json'
const baseEndpoint = config.siteConfiguration.apiRoute + "/alert";

// Jaedan: A verifyUser function may need to be included for some of these routes

export default function alertApiRoute(app) {

    app.post(baseEndpoint + '/create', async function(req, res) {
        // Some of these may not be const but have been assumed to be so thus far.
        const alertSlug = req.body.alertSlug;
        const body = req.body.body;
        const motd = req.body.motd;
        const tips = req.body.tips;
        const web = req.body.web;
        const link = req.body.link;
        const motdFormat = req.body.motdFormat;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        const alertSlug = req.body.alertSlug;
        const body = req.body.body;
        const motd = req.body.motd;
        const tips = req.body.tips;
        const web = req.body.web;
        const link = req.body.link;
        const motdFormat = req.body.motdFormat;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const alertSlug = req.body.alertSlug;

        // ...
        res.send({ success: true });
    });
}