import {isFeatureEnabled, required, optional} from '../common'

export default function appealApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/appeal';

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.appeals, res, lang);
        const punishmentId = required(req.body, "punishmentId", res);

        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.appeals, res, lang);
        const punishmentId = optional(req.query, "punishmentId");

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/comment', async function(req, res) {
        isFeatureEnabled(features.appeals, res, lang);
        const punishmentId = required(req.body, "punishmentId", res);
        const staffId = optional(req.body, "staffId");
        const content = required(req.body, "content", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/accept', async function(req, res) {
        isFeatureEnabled(features.appeals, res, lang);
        const punishmentId = required(req.body, "punishmentId", res);
        const staffId = required(req.body, "staffId", res);
        const content = optional(req.body, "content");

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deny', async function(req, res) {
        isFeatureEnabled(features.appeals, res, lang);
        const punishmentId = required(req.body, "punishmentId", res);
        const staffId = required(req.body, "staffId", res);
        const content = optional(req.body, "content");

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/escalate', async function(req, res) {
        isFeatureEnabled(features.appeals, res, lang);
        const punishmentId = required(req.body, "punishmentId", res);
        const staffId = required(req.body, "staffId", res);
        const content = optional(req.body, "content");

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deescalate', async function(req, res) {
        isFeatureEnabled(features.appeals, res, lang);
        const punishmentId = required(req.body, "punishmentId", res);
        const staffId = required(req.body, "staffId", res);
        const content = optional(req.body, "content");

        // ...
        res.send({ success: true });
    });

}