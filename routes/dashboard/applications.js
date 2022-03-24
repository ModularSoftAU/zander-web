export default function dashboardApplicationsSiteRoute(app, fetch, config) {

    // 
    // Applications
    // 
    app.get('/dashboard/applications', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        console.log(apiData);

        reply.view('dashboard/applications/list', {
            "pageTitle": `Dashboard - Applications`,
            config: config,
            apiData: apiData
        });
    });

    app.get('/dashboard/applications/create', async function(request, reply) {
        reply.view('dashboard/applications/editor', {
            "pageTitle": `Dashboard - Application Creator`,
            config: config,
            type: "create"
        });
    });

    app.get('/dashboard/applications/edit', async function(request, reply) {
        const id = request.query.id;
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get?id=${id}`;
        const response = await fetch(fetchURL);
        const applicationApiData = await response.json();

        console.log(applicationApiData);

        reply.view('dashboard/applications/editor', {
            "pageTitle": `Dashboard - Application Editor`,
            config: config,
            applicationApiData: applicationApiData.data[0],
            type: "edit"
        });
    });

}