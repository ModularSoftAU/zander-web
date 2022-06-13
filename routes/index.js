import dashboardSiteRoutes from './dashboard'
import knowledgebaseSiteRoutes from './knowledgebaseRoutes'
import policySiteRoutes from './policyRoutes'
import communityCreationsRoutes from './communityCreationsRoutes'
import sessionRoutes from './sessionRoutes'
import { isFeatureWebRouteEnabled, isLoggedIn } from "../api/common";

export default function applicationSiteRoutes(app, client, fetch, moment, config, db, features, lang) {

    dashboardSiteRoutes(app, client, fetch, moment, config, db, features, lang);
    knowledgebaseSiteRoutes(app, fetch, config, db, features, lang);
    communityCreationsRoutes(app, fetch, moment, config, db, features, lang);
    sessionRoutes(app, fetch, moment, config, db, features, lang);
    policySiteRoutes(app, config);

    app.get('/', async function(request, reply) {
        return reply.view("modules/index/index", {
            "pageTitle": `${config.siteConfiguration.siteName}`,
            config: config,
            request: request,
            features: features
        });
    });

    // 
    // Play
    // 
    app.get('/play', async function(request, reply) {
        isFeatureWebRouteEnabled(features.servers, request, reply);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visible=true`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        return reply.view('modules/play/play', {
            "pageTitle": `Play`,
            config: config,
            request: request,
            apiData: apiData,
            features: features
        });
    });

    // 
    // Apply
    // 
    app.get('/apply', async function(request, reply) {
        isFeatureWebRouteEnabled(features.applications, request, reply);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('apply', {
            "pageTitle": `Apply`,
            config: config,
            request: request,
            apiData: apiData,
            features: features
        });
    });

    // 
    // Events
    // 
    app.get('/events', async function(request, reply) {
        isFeatureWebRouteEnabled(features.events, request, reply);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?published=show`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('events', {
            "pageTitle": `Events`,
            config: config,
            apiData: apiData,
            moment: moment,
            request: request,
            features: features,
        });
    });

    // 
    // Vote
    // 
    app.get('/vote', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/vote/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('vote', {
            "pageTitle": `Vote`,
            config: config,
            request: request,
            features: features,
            apiData: apiData
        });
    });

    // 
    // Staff
    // 
    app.get('/staff', async function(request, reply) {
        reply.view('staff', {
            "pageTitle": `Staff`,
            config: config,
            request: request,
            features: features
        });
    });

    // 
    // Report
    // 
    app.get('/report', async function(request, reply) {
        isFeatureWebRouteEnabled(features.report, request, reply);

        if (!isLoggedIn(request)) {
            return reply.view('session/notLoggedIn', {
                "pageTitle": `Access Restricted`,
                config: config,
                request: request,
                reply: reply
            });        
        }

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visable=true`;
        const response = await fetch(fetchURL);
        const serverApiData = await response.json();

        reply.view('report', {
            "pageTitle": `Report a Player`,
            config: config,
            request: request,
            serverApiData: serverApiData.data,
            features: features
        });
    });

    // 
    // Report Specific
    // 
    app.get('/report/:id', async function(request, reply) {
        isFeatureWebRouteEnabled(features.report, request, reply);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/get?reportId=${request.params.id}`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('reportView', {
            "pageTitle": `#${request.params.id} Report Card`,
            config: config,
            request: request,
            moment: moment,
            apiData: apiData,
            features: features
        });
    });

    // 
    // Profile
    // 
    app.get('/profile/:username', async function(request, reply) {
        isFeatureWebRouteEnabled(features.userProfiles, request, reply);

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
            reportApiData: reportApiData,
            features: features

        });
    });

    // 
    // User Notifications
    // 
    app.get('/notifications', async function(request, reply) {
        if (!isLoggedIn(request)) {
            return reply.view('session/notLoggedIn', {
                "pageTitle": `Access Restricted`,
                config: config,
                request: request,
                reply: reply
            });        
        }

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/user/notification/get?username=${request.params.username}`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();
        
        reply.view('notifications', {
            "pageTitle": `Notifications`,
            config: config,
            apiData: apiData,
            moment: moment,
            request: request,
            features: features
        });
    });

    // 
    // Punishments
    // 
    app.get('/punishments', async function(request, reply) {
        isFeatureWebRouteEnabled(features.punishments, request, reply);

        reply.view('punishments', {
            "pageTitle": `Punishments`,
            config: config,
            request: request,
            features: features
        });
    });

    // 
    // Appeal
    // 
    app.get('/appeal', async function(request, reply) {
        if (!isLoggedIn(request)) {
            return reply.view('session/notLoggedIn', {
                "pageTitle": `Access Restricted`,
                config: config,
                request: request,
                reply: reply
            });        
        }
        
        isFeatureWebRouteEnabled(features.appeals, request, reply);

        reply.view('appeal', {
            "pageTitle": `Appeal`,
            config: config,
            request: request,
            features: features
        });
    });

    // 
    // Shopping District Directory
    // 
    app.get('/shoppingDistrictDirectory', async function(request, reply) {
        isFeatureWebRouteEnabled(features.shops, request, reply);

        reply.view('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config,
            request: request,
            features: features
        });
    });
    
    app.get('/shoppingDistrictDirectory/create', async function(request, reply) {
        isFeatureWebRouteEnabled(features.shops, request, reply);

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