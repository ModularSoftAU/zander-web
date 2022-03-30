export default function communityCreationSiteRoute(app, fetch, moment, config) {

    // 
    // Community Creations
    // 
    app.get('/communityCreations/:page?', async function(request, reply) {
	const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/communitycreation/get?page=${request.params.page || 1}`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();
        
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