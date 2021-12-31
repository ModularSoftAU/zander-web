const config = require('../config.json');
const path = require('path');
const fs = require('fs');

module.exports = (app) => {

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
    app.get('/play', (req, res, next) => {
        res.render('modules/play/play', {
            "pageTitle": `Play`,
            config: config
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
    app.get('/apply', (req, res, next) => {
        res.render('apply', {
            "pageTitle": `Apply`,
            config: config
        });
    });

    // 
    // Events
    // 
    app.get('/events', (req, res, next) => {
        res.render('events', {
            "pageTitle": `Events`,
            config: config
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
        res.render('modules/profile/profile', {
            "pageTitle": `Steve's Profile`,
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