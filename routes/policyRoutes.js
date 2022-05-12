export default function policySiteRoute(app, config, features, lang) {

    app.get('/terms', async function(request, reply) {
        reply.view('policy/termsOfService', {
            "pageTitle": `Network Terms Of Service`,
            config: config,
            request: request
        });
    });

    app.get('/rules', async function(request, reply) {
        reply.view('policy/rules', {
            "pageTitle": `Network Rules`,
            config: config,
            request: request
        });
    });

    app.get('/privacy', async function(request, reply) {
        reply.view('policy/privacy', {
            "pageTitle": `Network Privacy Policy`,
            config: config,
            request: request
        });
    });

    app.get('/refund', async function(request, reply) {
        reply.view('policy/refund', {
            "pageTitle": `Network Refund Policy`,
            config: config,
            request: request
        });
    });

}