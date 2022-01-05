export default function dashboardEventSiteRoute(app, fetch, moment, config) {

    // 
    // Events
    // 
    app.get('/dashboard/events', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?published=all`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();
                
        reply.render('dashboard/events/list', {
            "pageTitle": `Dashboard - Events`,
            config: config,
            apiData: apiData,
            moment: moment
        });
    });

    app.get('/dashboard/events/editor', async function(request, reply) {
        reply.render('dashboard/events/editor', {
            "pageTitle": `Dashboard - Event Editor`,
            config: config
        });
    });

}