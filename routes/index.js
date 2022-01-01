const config = require('../config.json');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

module.exports = (app, moment) => {

    require('./dashboard')(app);
    require('./dashboardRoutes')(app);
    require('./knowledgebaseRoutes')(app);
    require('./policyRoutes')(app);

    app.get('/', (req, res, next) => {
        res.render('modules/index/index', {
            "pageTitle": `${config.siteConfiguration.siteName}`,
            config: config
        });
    });

    // 
    // Play
    // 
    app.get('/play', async (req, res, next) => {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visible=true`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        res.render('modules/play/play', {
            "pageTitle": `Play`,
            config: config,
            apiData: apiData
        });
    });

    // 
    // Community Creations
    // 
    app.get('/communityCreations', (req, res, next) => {
        res.render('modules/communityCreation/communityCreation', {
            "pageTitle": `Community Creations`,
            config: config
        });
    });

    app.get('/communityCreation/submit', (req, res, next) => {
        res.render('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config
        });
    });

    // 
    // Apply
    // 
    app.get('/apply', async (req, res, next) => {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        res.render('apply', {
            "pageTitle": `Apply`,
            config: config,
            apiData: apiData
        });
    });

    // 
    // Events
    // 
    app.get('/events', async (req, res, next) => {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?published=show`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        res.render('events', {
            "pageTitle": `Events`,
            config: config,
            apiData: apiData,
            moment: moment
        });
    });

    // 
    // Vote
    // 
    app.get('/vote', (req, res, next) => {
        res.render('vote', {
            "pageTitle": `Vote`,
            config: config
        });
    });

    // 
    // Staff
    // 
    app.get('/staff', (req, res, next) => {
        res.render('staff', {
            "pageTitle": `Staff`,
            config: config
        });
    });

    // 
    // Profile
    // 
    app.get('/profile', (req, res, next) => {
        res.render('profile', {
            "pageTitle": `USERNAME's Profile`,
            config: config
        });
    });

    // 
    // Punishments
    // 
    app.get('/punishments', (req, res, next) => {
        res.render('punishments', {
            "pageTitle": `Punishments`,
            config: config
        });
    });

    // 
    // Session
    // 
    app.get('/login', (req, res, next) => {
        res.render('login', {
            "pageTitle": `Login`,
            config: config
        });
    });

    app.get('/register', (req, res, next) => {
        res.render('register', {
            "pageTitle": `Register`,
            config: config
        });
    });

    // 
    // Appeal
    // 
    app.get('/appeal', (req, res, next) => {
        res.render('appeal', {
            "pageTitle": `Appeal`,
            config: config
        });
    });

    // 
    // Shopping District Directory
    // 
    app.get('/shoppingDistrictDirectory', (req, res, next) => {
        res.render('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config
        });
    });

    app.get('/sdd', (req, res, next) => {
        res.render('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config
        });
    });

    app.get('/shoppingDistrictDirectory/create', (req, res, next) => {
        fs.readdir(path.join(__dirname, '../assets/images/minecraftItemImages'), function(err, files) {
            //handling error
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            //listing all files using forEach
            files.forEach(function(file) {
                // Do whatever you want to do with the file
                // console.log(file);
            });

            res.render('modules/shoppingDistrictDirectory/create', {
                "pageTitle": `Shopping District Directory`,
                config: config,
                minecraftItem: files
            });
        });
    });

}