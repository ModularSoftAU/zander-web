import { isFeatureWebRouteEnabled, getGlobalImage} from "../api/common";

export default function communityCreationSiteRoute(app, client, fetch, moment, config, db, features, lang) {

    // 
    // Community Creations
    // 
    app.get('/communityCreations/:page?', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.communitycreations, req, res))
            return;

        const fetchURL = `${config.siteConfiguration.siteAddress}/api/communitycreation/get?page=${req.params.page || 1}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        return res.view('modules/communityCreation/communityCreation', {
            "pageTitle": `Community Creations`,
            config: config,
            req: req,
            moment: moment,
            apiData: apiData,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    app.get('/communityCreation/submit', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.communitycreations, req, res))
            return;
        
        res.view('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

}