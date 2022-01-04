import config from '../config.json'
import path from 'path'
import fs from 'fs'

import dashboardSiteRoutes from './dashboard'
import knowledgebaseSiteRoutes from './knowledgebaseRoutes'
import policySiteRoutes from './policyRoutes'

export default function applicationSiteRoutes(app, moment, fetch) {

    // dashboardSiteRoutes(app, moment, fetch);
    // knowledgebaseSiteRoutes(app);
    // policySiteRoutes(app);

    // require('./dashboard')(app, fetch, moment);
    // require('./knowledgebaseRoutes')(app);
    // require('./policyRoutes')(app);

    app.get('/', async function(request, reply) {
        return reply.view("modules/index/index", {
            "pageTitle": `${config.siteConfiguration.siteName}`,
            config: config
        });
    });

    // 
    // Play
    // 
    app.get('/play', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visible=true`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        return reply.view('modules/play/play', {
            "pageTitle": `Play`,
            config: config,
            apiData: apiData
        });
    });

    // // 
    // // Community Creations
    // // 
    // app.get('/communityCreations', function(request, reply) => {
    //     res.render('modules/communityCreation/communityCreation', {
    //         "pageTitle": `Community Creations`,
    //         config: config
    //     });
    // });

    // app.get('/communityCreation/submit', function(request, reply) => {
    //     res.render('modules/communityCreation/submit', {
    //         "pageTitle": `Submit a Community Creation`,
    //         config: config
    //     });
    // });

    // // 
    // // Apply
    // // 
    // app.get('/apply', async function(request, reply) => {
    //     const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get`;
    //     const response = await fetch(fetchURL);
    //     const apiData = await response.json();

    //     res.render('apply', {
    //         "pageTitle": `Apply`,
    //         config: config,
    //         apiData: apiData
    //     });
    // });

    // // 
    // // Events
    // // 
    // app.get('/events', async function(request, reply) => {
    //     const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?published=show`;
    //     const response = await fetch(fetchURL);
    //     const apiData = await response.json();

    //     res.render('events', {
    //         "pageTitle": `Events`,
    //         config: config,
    //         apiData: apiData,
    //         moment: moment
    //     });
    // });

    // // 
    // // Vote
    // // 
    // app.get('/vote', function(request, reply) => {
    //     res.render('vote', {
    //         "pageTitle": `Vote`,
    //         config: config
    //     });
    // });

    // // 
    // // Staff
    // // 
    // app.get('/staff', function(request, reply) => {
    //     res.render('staff', {
    //         "pageTitle": `Staff`,
    //         config: config
    //     });
    // });

    // // 
    // // Profile
    // // 
    // app.get('/profile', function(request, reply) => {
    //     res.render('modules/profile/profile', {
    //         "pageTitle": `Steve's Profile`,
    //         config: config
    //     });
    // });

    // // 
    // // Punishments
    // // 
    // app.get('/punishments', function(request, reply) => {
    //     res.render('punishments', {
    //         "pageTitle": `Punishments`,
    //         config: config
    //     });
    // });

    // // 
    // // Session
    // // 
    // app.get('/login', function(request, reply) => {
    //     res.render('login', {
    //         "pageTitle": `Login`,
    //         config: config
    //     });
    // });

    // app.get('/register', function(request, reply) => {
    //     res.render('register', {
    //         "pageTitle": `Register`,
    //         config: config
    //     });
    // });

    // // 
    // // Appeal
    // // 
    // app.get('/appeal', function(request, reply) => {
    //     res.render('appeal', {
    //         "pageTitle": `Appeal`,
    //         config: config
    //     });
    // });

    // // 
    // // Shopping District Directory
    // // 
    // app.get('/shoppingDistrictDirectory', function(request, reply) => {
    //     res.render('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
    //         "pageTitle": `Shopping District Directory`,
    //         config: config
    //     });
    // });

    // app.get('/sdd', function(request, reply) => {
    //     res.render('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
    //         "pageTitle": `Shopping District Directory`,
    //         config: config
    //     });
    // });

    // app.get('/shoppingDistrictDirectory/create', function(request, reply) => {
    //     fs.readdir(path.join(__dirname, '../assets/images/minecraftItemImages'), function(err, files) {
    //         //handling error
    //         if (err) {
    //             return console.log('Unable to scan directory: ' + err);
    //         }
    //         //listing all files using forEach
    //         files.forEach(function(file) {
    //             // Do whatever you want to do with the file
    //             // console.log(file);
    //         });

    //         res.render('modules/shoppingDistrictDirectory/create', {
    //             "pageTitle": `Shopping District Directory`,
    //             config: config,
    //             minecraftItem: files
    //         });
    //     });
    // });

}