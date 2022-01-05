const baseEndpoint = config.siteConfiguration.apiRoute + '/vote';

export default function voteApiRoute(app, config, db) {

    app.post(baseEndpoint + '/cast', async function(req, res) {
        const username = req.body.username;
        const voteDateTime = req.body.voteDateTime;
        const service = req.body.service;

        // ...
        res.send({ success: true });
    });

    app.get(baseEndpoint + '/get', async function(req, res) {
        // ...
        res.send({ success: true });
    });

}