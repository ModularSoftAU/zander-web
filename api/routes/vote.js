export default function voteApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/vote';

    app.post(baseEndpoint + '/cast', async function(req, res) {
        if (features.vote == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.body.username;
        const voteDateTime = req.body.voteDateTime;
        const service = req.body.service;

        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/get', async function(req, res) {
        if (features.vote == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }
        
        // ...
        res.send({ success: true });
    });

}