export default function dashboardRanksSiteRoute(app, fetch, config) {

    // 
    // Ranks
    // 
    app.get('/dashboard/ranks', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/rank/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();
        
        reply.view('dashboard/ranks/list', {
            "pageTitle": `Dashboard - Ranks`,
            config: config,
            apiData: apiData
        });
    });

    app.get('/dashboard/ranks/editor', async function(request, reply) {
        reply.view('dashboard/ranks/editor', {
            "pageTitle": `Dashboard - Rank Editor`,
            config: config
        });
    });

}