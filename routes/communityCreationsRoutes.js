export default function communityCreationSiteRoute(app, fetch, moment, config) {

    // 
    // Community Creations
    // 
    app.get('/communityCreations', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/communitycreation/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        console.log(apiData);

        return reply.view('modules/communityCreation/communityCreation', {
            "pageTitle": `Community Creations`,
            config: config,
            request: request,
            moment: moment,
            apiData: apiData
        });
    });

    app.get('/communityCreation/submit', async function(request, reply) {
        reply.view('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config,
            request: request
        });
    });

}