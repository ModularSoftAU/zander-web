import { hasPermission } from "../../api/common";

export default function dashboardRanksSiteRoute(app, fetch, config, features, lang) {

    // 
    // Ranks
    // 
    app.get('/dashboard/ranks', async function (req, res) {
        hasPermission('zander.web.rank', req, res, features);

		// Note: One or more of these could be null.
        const username = req.query.username;
        const rank = req.query.rank;
		
        const fetchURL = `${process.env.siteAddress}/api/rank/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();
        
        res.view('dashboard/ranks/get', {
            "pageTitle": `Dashboard - Ranks`,
            config: config,
            apiData: apiData,
            features: features
        });
    });

    app.get('/dashboard/ranks/users', async function (req, res) {
        hasPermission('zander.web.rank', req, res, features);

        const rank = req.query.rank;
		
		const fetchURL = `${process.env.siteAddress}/api/rank/get?rank=${rank}`;
		const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
		const apiData = await response.json();
		const rankDisplayName = (apiData.data.length > 0 ? apiData.data[0].displayName : rank)
		
        res.view('dashboard/ranks/users', {
            "pageTitle": `Dashboard - Rank Users`,
			"rankDisplayName": rankDisplayName,
            config: config,
			apiData: apiData,
            features: features
        });
    });

}