export default function communityCreationSiteRoute(app, fetch, moment, config) {

    // 
    // Community Creations
    // 
    app.get('/communityCreations', async function(request, reply) {
        return reply.view('modules/communityCreation/communityCreation', {
            "pageTitle": `Community Creations`,
            config: config,
            request: request,
            features: features
        });
    });

    app.get('/communityCreation/submit', async function(request, reply) {
        reply.view('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config,
            request: request,
            features: features
        });
    });

}