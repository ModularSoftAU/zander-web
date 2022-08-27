import {isFeatureEnabled, required, optional} from '../common'

export default function punishmentApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/punishment';

    app.post(baseEndpoint + '/issue', async function(req, res) {
        isFeatureEnabled(features.punishments, res, features, lang);
        const playerUsername = required(req.body, "playerUsername", res);
        const staffUsername = required(req.body, "staffUsername", res);
        const platform = required(req.body, "platform", res);
        const type = required(req.body, "type", res);
        const length = optional(req.body, "length");
        const reason = required(req.body, "reason", res);

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.punishments, res, features, lang);
        const punishmentId = required(req.body, "punishmentId", res);

        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.punishments, res, features, lang);

        // ...
        res.send({ success: true });
    });

}