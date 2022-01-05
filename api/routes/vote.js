export default function voteApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/vote';

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