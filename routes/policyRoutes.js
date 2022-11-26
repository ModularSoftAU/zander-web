import { getGlobalImage } from "../api/common";

export default function policySiteRoute(app, config, features) {

    app.get('/terms', async function (req, res) {
        res.view('policy/termsOfService', {
            "pageTitle": `Network Terms Of Service`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    app.get('/rules', async function (req, res) {
        res.view('policy/rules', {
            "pageTitle": `Network Rules`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    app.get('/privacy', async function (req, res) {
        res.view('policy/privacy', {
            "pageTitle": `Network Privacy Policy`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    app.get('/refund', async function (req, res) {
        res.view('policy/refund', {
            "pageTitle": `Network Refund Policy`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

}