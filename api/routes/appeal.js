import config from '../../config.json'
const baseEndpoint = config.siteConfiguration.apiRoute + "/appeal";

export default function appealApiRoute(app) {

    app.post(baseEndpoint + '/create', async function(req, res) {
        const punishmentId = req.body.punishmentId;

        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/:punishmentId', async function(req, res) {
        const punishmentId = req.params.punishmentId;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/comment', async function(req, res) {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/accept', async function(req, res) {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;
        const action = req.body.action;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deny', async function(req, res) {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;
        const action = req.body.action;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/escalate', async function(req, res) {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;
        const action = req.body.action;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deescalate', async function(req, res) {
        const punishmentId = req.body.punishmentId;
        const staffId = req.body.staffId;
        const content = req.body.content;
        const action = req.body.action;

        // ...
        res.send({ success: true });
    });

}