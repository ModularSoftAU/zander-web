import config from '../../config.json'

export default function dashboardRanksSiteRoute(app, fetch) {

    // 
    // Ranks
    // 
    app.get('/dashboard/ranks', async (req, res, next) => {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/rank/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();
        
        res.render('dashboard/ranks/list', {
            "pageTitle": `Dashboard - Ranks`,
            config: config,
            apiData: apiData
        });
    });

    app.get('/dashboard/ranks/editor', (req, res, next) => {
        res.render('dashboard/ranks/editor', {
            "pageTitle": `Dashboard - Rank Editor`,
            config: config
        });
    });

}