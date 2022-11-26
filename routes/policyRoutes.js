import { getGlobalImage } from "../api/common";

export default function policySiteRoute(app, config, features) {

    app.get('/terms', async function (req, reply) {
        reply.view('policy/termsOfService', {
            "pageTitle": `Network Terms Of Service`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    app.get('/rules', async function (req, reply) {
        reply.view('policy/rules', {
            "pageTitle": `Network Rules`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    app.get('/privacy', async function (req, reply) {
        reply.view('policy/privacy', {
            "pageTitle": `Network Privacy Policy`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    app.get('/refund', async function (req, reply) {
        reply.view('policy/refund', {
            "pageTitle": `Network Refund Policy`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

}