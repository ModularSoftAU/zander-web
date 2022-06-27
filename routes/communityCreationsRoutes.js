import {
    isFeatureWebRouteEnabled
} from "../api/common";

export default function communityCreationSiteRoute(app, client, fetch, moment, config, db, features, lang) {

    // 
    // Community Creations
    // 
    app.get('/communityCreations/:page?', async function (request, reply) {
        if (!isFeatureWebRouteEnabled(features.communitycreations, request, reply))
            return;

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/communitycreation/get?page=${request.params.page || 1}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        return reply.view('modules/communityCreation/communityCreation', {
            "pageTitle": `Community Creations`,
            config: config,
            request: request,
            moment: moment,
            apiData: apiData,
            features: features
        });
    });

    app.get('/communityCreation/submit', async function (request, reply) {
        if (!isFeatureWebRouteEnabled(features.communitycreations, request, reply))
            return;
        
        reply.view('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config,
            request: request,
            features: features
        });
    });

}