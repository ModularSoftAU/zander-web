const baseEndpoint = config.siteConfiguration.apiRoute + '/web';

export default function webApiRoute(app, config, db) {

    app.post(baseEndpoint + '/login', async function(req, res) {
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/register/create', async function(req, res) {
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/register/verify', async function(req, res) {
        const username = req.body.username;
        const verificationToken = req.body.verificationToken;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/forgot', async function(req, res) {
        const username = req.body.username;
        // TODO

        // ...
        res.send({ success: true });
    });

}