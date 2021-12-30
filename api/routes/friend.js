const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/friend";

module.exports = (app) => {

    app.post(baseEndpoint + '/request', (req, res, next) => {
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/accept', (req, res, next) => {
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;
        const action = req.body.action;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/deny', (req, res, next) => {
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;
        const action = req.body.action;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/block', (req, res, next) => {
        const requestee = req.body.requestee;
        const requestedUser = req.body.requestedUser;
        const action = req.body.action;

        // ...
        res.json({ success: true });
    });

}