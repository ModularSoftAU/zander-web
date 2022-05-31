import { hasPermission } from "../../api/common";

export default function dashboardRanksSiteRoute(app, fetch, config, features, lang) {

    // 
    // Ranks
    // 
    app.get('/dashboard/ranks', async function(request, reply) {
        hasPermission('zander.web.rank', request, reply);

		// Note: One or more of these could be null.
        const username = request.query.username;
        const rank = request.query.rank;
		
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/rank/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();
        
        reply.view('dashboard/ranks/get', {
            "pageTitle": `Dashboard - Ranks`,
            config: config,
            apiData: apiData,
            features: features
        });
    });

    app.get('/dashboard/ranks/users', async function(request, reply) {
        hasPermission('zander.web.rank', request, reply);

		const rank = request.query.rank;
		
		const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/rank/get?rank=${rank}`;
		const response = await fetch(fetchURL);
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