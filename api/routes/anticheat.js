const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/anticheat";

module.exports = (app) => {

    app.post(baseEndpoint + '/flag', (req, res, next) => {
        const username = req.body.username;
        const anticheatDateTime = req.body.anticheatDateTime;
        const type = req.body.type;

        // ...
        res.json({ success: true });
    });

}