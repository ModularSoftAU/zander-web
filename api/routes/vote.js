import config from '../../config.json'
const baseEndpoint = config.siteConfiguration.apiRoute + "/vote";

export default function voteApiRoute(app) {

    app.post(baseEndpoint + '/cast', (req, res, next) => {
        const username = req.body.username;
        const voteDateTime = req.body.voteDateTime;
        const service = req.body.service;

        // ...
        res.json({ success: true });
    });

    app.get(baseEndpoint + '/get', (req, res, next) => {
        // ...
        res.json({ success: true });
    });

}
