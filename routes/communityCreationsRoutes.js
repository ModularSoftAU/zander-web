import { isFeatureWebRouteEnabled, getGlobalImage} from "../api/common";

export default function communityCreationSiteRoute(app, client, fetch, moment, config, db, features, lang) {

    // 
    // Community Creations
    // 
    app.get('/communityCreations/:page?', async function (req, reply) {
        if (!isFeatureWebRouteEnabled(features.communitycreations, req, reply))
            return;

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/communitycreation/get?page=${req.params.page || 1}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        return reply.view('modules/communityCreation/communityCreation', {
            "pageTitle": `Community Creations`,
            config: config,
            req: req,
            moment: moment,
            apiData: apiData,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    app.get('/communityCreation/submit', async function (req, reply) {
        if (!isFeatureWebRouteEnabled(features.communitycreations, req, reply))
            return;
        
        reply.view('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

}