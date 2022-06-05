import {
    isFeatureWebRouteEnabled
} from "../api/common";

export default function communityCreationSiteRoute(app, fetch, moment, config, features, lang) {

    // 
    // Community Creations
    // 
    app.get('/communityCreations/:page?', async function (request, reply) {
        isFeatureWebRouteEnabled(features.communitycreations, request, reply);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/communitycreation/get?page=${request.params.page || 1}`;
        const response = await fetch(fetchURL);
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
        isFeatureWebRouteEnabled(features.communitycreations, request, reply);
        
        reply.view('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config,
            request: request,
            features: features
        });
    });

}