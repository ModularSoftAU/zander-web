import config from '../../config.json'

export default function dashbordSiteRoute(app) {

    // 
    // Dashboard
    // 
    app.get('/dashboard', (req, res, next) => {
        res.render('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    app.get('/dashboard/view/network', (req, res, next) => {
        res.render('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    app.get('/dashboard/view/punishment', (req, res, next) => {
        res.render('dashboard/indexViewPunishment', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    // 
    // Misc
    // 

    // 
    // Player Check
    // 
    app.get('/dashboard/usercheck', (req, res, next) => {
        res.render('dashboard/usercheck', {
            "pageTitle": `Dashboard - User Check`,
            config: config
        });
    });

}