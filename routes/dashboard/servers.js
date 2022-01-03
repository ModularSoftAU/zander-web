import config from '../../config.json'

export default function dashboardServersSiteRoute(app) {

    // 
    // Servers
    // 
    app.get('/dashboard/servers', (req, res, next) => {
        res.render('dashboard/servers/list', {
            "pageTitle": `Dashboard - Servers`,
            config: config
        });
    });

    app.get('/dashboard/servers/create', (req, res, next) => {
        res.render('dashboard/servers/create', {
            "pageTitle": `Dashboard - Server Creator`,
            config: config
        });
    });

}