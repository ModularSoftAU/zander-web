export default function policySiteRoute(app, config) {

    app.get('/terms', async function(request, reply) {
        reply.view('policy/termsOfService', {
            "pageTitle": `Network Terms Of Service`,
            config: config
        });
    });

    app.get('/rules', async function(request, reply) {
        reply.view('policy/rules', {
            "pageTitle": `Network Rules`,
            config: config
        });
    });

    app.get('/privacy', async function(request, reply) {
        reply.view('policy/privacy', {
            "pageTitle": `Network Privacy Policy`,
            config: config
        });
    });

    app.get('/refund', async function(request, reply) {
        reply.view('policy/refund', {
            "pageTitle": `Network Refund Policy`,
            config: config
        });
    });

}