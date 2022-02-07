export default function anticheatApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/anticheat';

    app.post(baseEndpoint + '/flag', async function(req, res) {
        const username = req.body.username;
        const anticheatDateTime = req.body.anticheatDateTime;
        const type = req.body.type;

        // ...
        res.send({ success: true });
    });

}