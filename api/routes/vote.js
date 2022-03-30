import {isFeatureEnabled, required, optional} from '../common'

export default function voteApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/vote';

    app.post(baseEndpoint + '/cast', async function(req, res) {
        isFeatureEnabled(features.vote, res, lang);
        const username = required(req.body, "username", res);
        const voteDateTime = required(req.body, "voteDateTime", res);
        const service = required(req.body, "service", res);

        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.vote, res, lang);
                
        // ...
        res.send({ success: true });
    });

}