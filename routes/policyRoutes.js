import config from '../config.json'

export default function policySiteRoute(app) {

    app.get('/terms', (req, res, next) => {
        res.render('policy/termsOfService', {
            "pageTitle": `Network Terms Of Service Policy`,
            config: config
        });
    });

    app.get('/rules', (req, res, next) => {
        res.render('policy/rules', {
            "pageTitle": `Network Rules`,
            config: config
        });
    });

    app.get('/privacy', (req, res, next) => {
        res.render('policy/privacy', {
            "pageTitle": `Network Privacy Policy`,
            config: config
        });
    });

    app.get('/refund', (req, res, next) => {
        res.render('policy/refund', {
            "pageTitle": `Network Refund Policy`,
            config: config
        });
    });

}