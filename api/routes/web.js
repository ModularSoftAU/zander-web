const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/web";

export default function webApiRoute(app) {

    app.post(baseEndpoint + '/login', (req, res, next) => {
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/register/create', (req, res, next) => {
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/register/verify', (req, res, next) => {
        const username = req.body.username;
        const verificationToken = req.body.verificationToken;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/forgot', (req, res, next) => {
        const username = req.body.username;
        // TODO

        // ...
        res.json({ success: true });
    });

}
