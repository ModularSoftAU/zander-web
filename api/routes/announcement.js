export default function announcementApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/announcement';

    app.post(baseEndpoint + '/create', async function(req, res) {
        const announcementSlug = req.body.announcementSlug;
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
        const announcementSlug = req.body.announcementSlug;
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
        const announcementSlug = req.body.announcementSlug;

        // ...
        res.send({ success: true });
    });

}