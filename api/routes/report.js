export default function reportApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/report';

    app.get(baseEndpoint + '/get', async function(req, res) {
        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/get/:username', async function(req, res) {
        const username = req.params.username;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        const reportedUser = req.body.reportedUser;
        const reporterUser = req.body.reporterUser;
        const reason = req.body.reason;
        const evidence = req.body.evidence;
        const server = req.body.server;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/close', async function(req, res) {
        const reportId = req.body.reportId;

        // ...
        res.send({ success: true });
    });

}