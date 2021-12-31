const config = require('../../config.json');

module.exports = (app) => {

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

}