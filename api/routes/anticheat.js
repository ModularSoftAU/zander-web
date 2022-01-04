import config from '../../config.json'
const baseEndpoint = config.siteConfiguration.apiRoute + "/anticheat";

export default function anticheatApiRoute(app) {

    app.post(baseEndpoint + '/flag', async function(req, res) {
        const username = req.body.username;
        const anticheatDateTime = req.body.anticheatDateTime;
        const type = req.body.type;

        // ...
        res.send({ success: true });
    });

}