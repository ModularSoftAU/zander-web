export default function dashboardServersSiteRoute(app, fetch, config) {

    // 
    // Servers
    // 
    app.get('/dashboard/servers', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visible=all`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        console.log(apiData);

        reply.view('dashboard/servers/list', {
            "pageTitle": `Dashboard - Servers`,
            config: config,
            apiData: apiData
        });
    });

    app.get('/dashboard/servers/create', async function(request, reply) {
        reply.view('dashboard/servers/create', {
            "pageTitle": `Dashboard - Server Creator`,
            config: config
        });
    });

}