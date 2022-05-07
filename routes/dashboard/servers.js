export default function dashboardServersSiteRoute(app, fetch, config, features) {

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
            apiData: apiData,
            features: features
        });
    });

    app.get('/dashboard/servers/create', async function(request, reply) {
        reply.view('dashboard/servers/editor', {
            "pageTitle": `Dashboard - Server Creator`,
            config: config,
            type: "create",
            features: features
        });
    });

    app.get('/dashboard/servers/edit', async function(request, reply) {
        const id = request.query.id;
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?id=${id}`;
        const response = await fetch(fetchURL);
        const serverApiData = await response.json();

        console.log(serverApiData);

        reply.view('dashboard/servers/editor', {
            "pageTitle": `Dashboard - Server Editor`,
            config: config,
            serverApiData: serverApiData.data[0],
            type: "edit",
            features: features
        });
    });

}