const config = require('../../config.json');

module.exports = (app, fetch, moment) => {

    // 
    // Events
    // 
    app.get('/dashboard/events', async (req, res, next) => {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?published=all`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();
                
        res.render('dashboard/events/list', {
            "pageTitle": `Dashboard - Events`,
            config: config,
            apiData: apiData,
            moment: moment
        });
    });

    app.get('/dashboard/events/editor', (req, res, next) => {
        res.render('dashboard/events/editor', {
            "pageTitle": `Dashboard - Event Editor`,
            config: config
        });
    });

}