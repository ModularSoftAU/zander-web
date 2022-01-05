export default function dashboardServersSiteRoute(app, config) {

    // 
    // Servers
    // 
    app.get('/dashboard/servers', async function(request, reply) {
        reply.view('dashboard/servers/list', {
            "pageTitle": `Dashboard - Servers`,
            config: config
        });
    });

    app.get('/dashboard/servers/create', async function(request, reply) {
        reply.view('dashboard/servers/create', {
            "pageTitle": `Dashboard - Server Creator`,
            config: config
        });
    });

}