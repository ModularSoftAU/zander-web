import { setAuditLastPunishment } from '../../controllers/userController';
import {isFeatureEnabled, required, optional} from '../common'

export default function punishmentApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/punishment';

    app.post(baseEndpoint + '/issue', async function(req, res) {
        isFeatureEnabled(features.punishment, res, lang);
        const punishmentId = required(req.body, "punishmentId", res);
        const playerUsername = required(req.body, "playerUsername", res);
        const staffUsername = required(req.body, "staffUsername", res);
        const platform = required(req.body, "platform", res);
        const type = required(req.body, "type", res);
        const reason = required(req.body, "reason", res);

        generateLog(actioningUser, "PRIMARY", "PUNISHMENT", `${playerUsername} was ${type} by ${staffUsername} on ${platform} for ${reason}`, res);

        setAuditLastPunishment(username, res)

        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.punishment, res, lang);
        const punishmentId = required(req.body, "punishmentId", res);

        generateLog(actioningUser, "WARNING", "PUNISHMENT", `${punishmentId} has been revoked.`, res);

        setAuditLastPunishment(username, res)

        res.send({ success: true });
    });

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.punishment, res, lang);

        // ...
        res.send({ success: true });
    });

}