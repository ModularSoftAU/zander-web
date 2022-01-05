export default function policySiteRoute(app, config) {

    app.get('/terms', async function(request, reply) {
        reply.render('policy/termsOfService', {
            "pageTitle": `Network Terms Of Service`,
            config: config
        });
    });

    app.get('/rules', async function(request, reply) {
        reply.render('policy/rules', {
            "pageTitle": `Network Rules`,
            config: config
        });
    });

    app.get('/privacy', async function(request, reply) {
        reply.render('policy/privacy', {
            "pageTitle": `Network Privacy Policy`,
            config: config
        });
    });

    app.get('/refund', async function(request, reply) {
        reply.render('policy/refund', {
            "pageTitle": `Network Refund Policy`,
            config: config
        });
    });

}