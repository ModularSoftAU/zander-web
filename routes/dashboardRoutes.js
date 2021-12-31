const config = require('../config.json');

module.exports = (app) => {

    app.get('/dashboard', (req, res, next) => {
        res.render('dashboard/index', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    // 
    // Player Check
    // 
    app.get('/dashboard/playercheck', (req, res, next) => {
        res.render('dashboard/playerCheck', {
            "pageTitle": `Dashboard - Player Check`,
            config: config
        });
    });

    // 
    // Events
    // 
    app.get('/dashboard/events', (req, res, next) => {
        res.render('dashboard/events/list', {
            "pageTitle": `Dashboard - Events`,
            config: config
        });
    });

    app.get('/dashboard/events/schedule', (req, res, next) => {
        res.render('dashboard/events/schedule', {
            "pageTitle": `Dashboard - Event Planner`,
            config: config
        });
    });

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

    // 
    // Knowledgebase
    // 
    app.get('/dashboard/knowledgebase', (req, res, next) => {
        res.render('dashboard/knowledgebase/list', {
            "pageTitle": `Dashboard - Knowledgebase`,
            config: config
        });
    });

    app.get('/dashboard/knowledgebase/create/section', (req, res, next) => {
        res.render('dashboard/knowledgebase/createSection', {
            "pageTitle": `Dashboard - Create Knowledgebase Section`,
            config: config
        });
    });

    app.get('/dashboard/knowledgebase/create/article', (req, res, next) => {
        res.render('dashboard/knowledgebase/createArticle', {
            "pageTitle": `Dashboard - Create Knowledgebase Article`,
            config: config
        });
    });

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