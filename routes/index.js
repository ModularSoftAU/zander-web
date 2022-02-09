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
            config: config,
            request: request
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
            request: request,
            apiData: apiData
        });
    });

    // 
    // Community Creations
    // 
    app.get('/communityCreations', async function(request, reply) {
        return reply.view('modules/communityCreation/communityCreation', {
            "pageTitle": `Community Creations`,
            config: config,
            request: request
        });
    });

    app.get('/communityCreation/submit', async function(request, reply) {
        reply.view('modules/communityCreation/submit', {
            "pageTitle": `Submit a Community Creation`,
            config: config,
            request: request
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
            request: request,
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
            moment: moment,
            request: request
        });
    });

    // 
    // Vote
    // 
    app.get('/vote', async function(request, reply) {
        reply.view('vote', {
            "pageTitle": `Vote`,
            config: config,
            request: request
        });
    });

    // 
    // Staff
    // 
    app.get('/staff', async function(request, reply) {
        reply.view('staff', {
            "pageTitle": `Staff`,
            config: config,
            request: request
        });
    });

    // 
    // Report Specific
    // 
    app.get('/report/:id', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/get?id=${request.params.id}`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('reportView', {
            "pageTitle": `#${request.params.id} Report Card`,
            config: config,
            request: request,
            moment: moment,
            apiData: apiData
        });
    });

    // 
    // Profile
    // 
    app.get('/profile/:username', async function(request, reply) {
        // Get Player Profile Information
        const profileFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/user/get?username=${request.params.username}`;
        const profileResponse = await fetch(profileFetchURL);
        const profileApiData = await profileResponse.json();

        // Get Player Report Information
        const reportFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/get?username=${request.params.username}`;
        const reportResponse = await fetch(reportFetchURL);
        const reportApiData = await reportResponse.json();

        reply.view('modules/profile/profile', {
            "pageTitle": `${profileApiData.data[0].username}'s Profile`,
            config: config,
            moment: moment,
            request: request,
            profileApiData: profileApiData,
            reportApiData: reportApiData

        });
    });

    // 
    // User Notifications
    // 
    app.get('/notifications', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/user/notifications/get?username=${request.params.username}`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('notifications', {
            "pageTitle": `Notifications`,
            config: config,
            apiData: apiData,
            moment: moment,
            request: request
        });
    });

    // 
    // Punishments
    // 
    app.get('/punishments', async function(request, reply) {
        reply.view('punishments', {
            "pageTitle": `Punishments`,
            config: config,
            request: request
        });
    });

    // 
    // Session
    // 
    app.get('/login', async function(request, reply) {
        reply.view('session/login', {
            "pageTitle": `Login`,
            config: config,
            request: request
        });
    });

    app.get('/register', async function(request, reply) {
        reply.view('session/register', {
            "pageTitle": `Register`,
            config: config,
            request: request
        });
    });

    app.get('/logout', async function(request, reply) {
        if (request.session.authenticated) {
            request.destroySession((err) => {
              if (err) {
                  console.log(err);
                throw err;
              } else {
                res.redirect('/')
              }
            })
          } else {
            reply.redirect('/')
          }
    });

    // 
    // Appeal
    // 
    app.get('/appeal', async function(request, reply) {
        reply.view('appeal', {
            "pageTitle": `Appeal`,
            config: config,
            request: request
        });
    });

    // 
    // Shopping District Directory
    // 
    app.get('/shoppingDistrictDirectory', async function(request, reply) {
        reply.view('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config,
            request: request
        });
    });

    app.get('/sdd', async function(request, reply) {
        reply.view('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config,
            request: request
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