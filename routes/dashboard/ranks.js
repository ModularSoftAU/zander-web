import { hasPermission } from "../../api/common";

export default function dashboardRanksSiteRoute(app, fetch, config, features, lang) {

    // 
    // Ranks
    // 
    app.get('/dashboard/ranks', async function (req, reply) {
        hasPermission('zander.web.rank', req, reply, features);

		// Note: One or more of these could be null.
        const username = req.query.username;
        const rank = req.query.rank;
		
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/rank/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();
        
        reply.view('dashboard/ranks/get', {
            "pageTitle": `Dashboard - Ranks`,
            config: config,
            apiData: apiData,
            features: features
        });
    });

    app.get('/dashboard/ranks/users', async function (req, reply) {
        hasPermission('zander.web.rank', req, reply, features);

        const rank = req.query.rank;
		
		const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/rank/get?rank=${rank}`;
		const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
		const apiData = await response.json();
		const rankDisplayName = (apiData.data.length > 0 ? apiData.data[0].displayName : rank)
		
        reply.view('dashboard/ranks/users', {
            "pageTitle": `Dashboard - Rank Users`,
			"rankDisplayName": rankDisplayName,
            config: config,
			apiData: apiData,
            features: features
        });
    });

}