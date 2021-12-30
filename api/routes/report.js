const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/report";

module.exports = (app) => {

    app.get(baseEndpoint + '/get', (req, res, next) => {
        // ...
        res.json({ success: true });
    });

    app.get(baseEndpoint + '/get/:username', (req, res, next) => {
        const username = req.params.username;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const reportedUser = req.body.reportedUser;
        const reporterUser = req.body.reporterUser;
        const reason = req.body.reason;
        const evidence = req.body.evidence;
        const server = req.body.server;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/close', (req, res, next) => {
        const reportId = req.body.reportId;

        // ...
        res.json({ success: true });
    });

}