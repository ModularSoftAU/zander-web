const config = require('../../config.json');

module.exports = (app) => {

    // 
    // Ranks
    // 
    app.get('/dashboard/ranks', (req, res, next) => {
        res.render('dashboard/ranks/list', {
            "pageTitle": `Dashboard - Ranks`,
            config: config
        });
    });

    app.get('/dashboard/ranks/create', (req, res, next) => {
        res.render('dashboard/ranks/create', {
            "pageTitle": `Dashboard - Rank Creator`,
            config: config
        });
    });

}