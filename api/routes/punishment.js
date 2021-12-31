const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/punishment";

module.exports = (app) => {

    app.post(baseEndpoint + '/issue', (req, res, next) => {
        const playerUsername = req.body.playerUsername;
        const staffUsername = req.body.staffUsername;
        const platform = req.body.platform;
        const type = req.body.type;
        const length = req.body.length;
        const reason = req.body.reason;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/delete', (req, res, next) => {
        const punishmentId = req.body.punishmentId;

        // ...
        res.json({ success: true });
    });

    app.get(baseEndpoint + '/user', (req, res, next) => {
        const username = req.query.username;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/latest', (req, res, next) => {
        const latest = req.body.latest;

        // ...
        res.json({ success: true });
    });

}
