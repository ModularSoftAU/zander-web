const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/appeal";

module.exports = (app) => {

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const punishmentId = req.body.punishmentId;

        // ...
        res.json({ success: true });
    });

    app.get(baseEndpoint + '/:punishmentId', (req, res, next) => {
        const punishmentId = req.params.punishmentId;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/comment', (req, res, next) => {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/accept', (req, res, next) => {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;
        const action = req.body.action;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/deny', (req, res, next) => {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;
        const action = req.body.action;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/escalate', (req, res, next) => {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;
        const action = req.body.action;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/deescalate', (req, res, next) => {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;
        const action = req.body.action;

        // ...
        res.json({ success: true });
    });

}