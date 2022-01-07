import path from 'path'
import fs from 'fs'

import dashboardSiteRoutes from './dashboard'
import knowledgebaseSiteRoutes from './knowledgebaseRoutes'
import policySiteRoutes from './policyRoutes'

export default function applicationSiteRoutes(app, fetch, moment, config) {

    dashboardSiteRoutes(app, fetch, moment, config);
    knowledgebaseSiteRoutes(app, fetch, config);
    policySiteRoutes(app, config);

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

    // 
    // Community Creations
    // 
    app.get('/communityCreations', async function(request, reply) {
        return reply.view('modules/communityCreation/communityCreation', {
            "pageTitle": `Community Creations`,
            config: config
        });
    });

    app.get('/communityCreation/submit', async function(request, reply) {
        reply.view('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config
        });
    });

    // 
    // Apply
    // 
    app.get('/apply', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('apply', {
            "pageTitle": `Apply`,
            config: config,
            apiData: apiData
        });
    });

    // 
    // Events
    // 
    app.get('/events', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?published=show`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('events', {
            "pageTitle": `Events`,
            config: config,
            apiData: apiData,
            moment: moment
        });
    });

    // 
    // Vote
    // 
    app.get('/vote', async function(request, reply) {
        reply.view('vote', {
            "pageTitle": `Vote`,
            config: config
        });
    });

    // 
    // Staff
    // 
    app.get('/staff', async function(request, reply) {
        reply.view('staff', {
            "pageTitle": `Staff`,
            config: config
        });
    });

    // 
    // Profile
    // 
    app.get('/profile', async function(request, reply) {
        reply.view('modules/profile/profile', {
            "pageTitle": `Steve's Profile`,
            config: config
        });
    });

    // 
    // Punishments
    // 
    app.get('/punishments', async function(request, reply) {
        reply.view('punishments', {
            "pageTitle": `Punishments`,
            config: config
        });
    });

    // 
    // Session
    // 
    app.get('/login', async function(request, reply) {
        reply.view('login', {
            "pageTitle": `Login`,
            config: config
        });
    });

    app.get('/register', async function(request, reply) {
        reply.view('register', {
            "pageTitle": `Register`,
            config: config
        });
    });

    // 
    // Appeal
    // 
    app.get('/appeal', async function(request, reply) {
        reply.view('appeal', {
            "pageTitle": `Appeal`,
            config: config
        });
    });

    // 
    // Shopping District Directory
    // 
    app.get('/shoppingDistrictDirectory', async function(request, reply) {
        reply.view('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config
        });
    });

    app.get('/sdd', async function(request, reply) {
        reply.view('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config
        });
    });

    app.get('/shoppingDistrictDirectory/create', async function(request, reply) {
        // fs.readdir(path.join(__dirname, '../assets/images/minecraftItemImages'), function(err, files) {
        //     //handling error
        //     if (err) {
        //         return console.log('Unable to scan directory: ' + err);
        //     }
        //     //listing all files using forEach
        //     files.forEach(function(file) {
        //         // Do whatever you want to do with the file
        //         // console.log(file);
        //     });

        //     reply.view('modules/shoppingDistrictDirectory/create', {
        //         "pageTitle": `Shopping District Directory`,
        //         config: config,
        //         minecraftItem: files
        //     });
        // });
    });

}