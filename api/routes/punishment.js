export default function punishmentApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/punishment';

    app.post(baseEndpoint + '/issue', async function(req, res) {
        if (features.punishments == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const playerUsername = req.body.playerUsername;
        const staffUsername = req.body.staffUsername;
        const platform = req.body.platform;
        const type = req.body.type;
        const length = req.body.length;
        const reason = req.body.reason;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (features.punishments == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const punishmentId = req.body.punishmentId;

        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/user', async function(req, res) {
        if (features.punishments == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.query.username;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/latest', async function(req, res) {
        if (features.punishments == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }
        
        const latest = req.body.latest;

        // ...
        res.send({ success: true });
    });

}