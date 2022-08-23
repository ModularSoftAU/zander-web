import dashboardSiteRoutes from './dashboard'
import knowledgebaseSiteRoutes from './knowledgebaseRoutes'
import policySiteRoutes from './policyRoutes'
import communityCreationsRoutes from './communityCreationsRoutes'
import sessionRoutes from './sessionRoutes'
import { isFeatureWebRouteEnabled, isLoggedIn, getGlobalImage } from "../api/common";

export default function applicationSiteRoutes(app, client, fetch, moment, config, db, features, lang) {

    dashboardSiteRoutes(app, client, fetch, moment, config, db, features, lang);
    knowledgebaseSiteRoutes(app, client, fetch, moment, config, db, features, lang);
    communityCreationsRoutes(app, client, fetch, moment, config, db, features, lang);
    sessionRoutes(app, client, fetch, moment, config, db, features, lang);
    policySiteRoutes(app, config, features);

    app.get('/', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/web/statistics`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const statApiData = await response.json();

        return reply.view("modules/index/index", {
            "pageTitle": `${config.siteConfiguration.siteName}`,
            config: config,
            request: request,
            features: features,
            globalImage: await getGlobalImage(),
            statApiData: statApiData
        });
    });

    // 
    // Play
    // 
    app.get('/play', async function(request, reply) {
        isFeatureWebRouteEnabled(features.servers, request, reply, features);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visible=true`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        return reply.view('modules/play/play', {
            "pageTitle": `Play`,
            config: config,
            request: request,
            apiData: apiData,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Apply
    // 
    app.get('/apply', async function(request, reply) {
        isFeatureWebRouteEnabled(features.applications, request, reply, features);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        reply.view('apply', {
            "pageTitle": `Apply`,
            config: config,
            request: request,
            apiData: apiData,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Events
    // 
    app.get('/events', async function(request, reply) {
        isFeatureWebRouteEnabled(features.events, request, reply, features);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?published=show`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        reply.view('events', {
            "pageTitle": `Events`,
            config: config,
            apiData: apiData,
            moment: moment,
            request: request,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Vote
    // 
    app.get('/vote', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/vote/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        reply.view('vote', {
            "pageTitle": `Vote`,
            config: config,
            request: request,
            features: features,
            apiData: apiData,
            globalImage: await getGlobalImage(),
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
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Report
    // 
    app.get('/report', async function(request, reply) {
        isFeatureWebRouteEnabled(features.report, request, reply, features);

        if (!isLoggedIn(request)) {
            return reply.view('session/notLoggedIn', {
                "pageTitle": `Access Restricted`,
                config: config,
                request: request,
                reply: reply,
                features: features,
                globalImage: await getGlobalImage(),
            });        
        }

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visable=true`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const serverApiData = await response.json();

        if (!serverApiData.success) {
            reply.view('session/error', {
                "pageTitle": `Server Error`,
                config: config,
                error: lang.error.noReportServers,
                request: request,
                features: features,
                globalImage: await getGlobalImage(),
            });
        }

        reply.view('report', {
            "pageTitle": `Report a Player`,
            config: config,
            request: request,
            serverApiData: serverApiData.data,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Report Specific
    // 
    app.get('/report/:id', async function(request, reply) {
        isFeatureWebRouteEnabled(features.report, request, reply, features);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/get?reportId=${request.params.id}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        reply.view('reportView', {
            "pageTitle": `#${request.params.id} Report Card`,
            config: config,
            request: request,
            moment: moment,
            apiData: apiData,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Profile
    // 
    app.get('/profile/:username', async function(request, reply) {
        isFeatureWebRouteEnabled(features.userProfiles, request, reply, features);

        // Get Player Profile Information
        const profileFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/user/get?username=${request.params.username}`;
        const profileResponse = await fetch(profileFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const profileApiData = await profileResponse.json();

        // Get Player Report Information
        const reportFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/get?username=${request.params.username}`;
        const reportResponse = await fetch(reportFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const reportApiData = await reportResponse.json();

        reply.view('modules/profile/profile', {
            "pageTitle": `${profileApiData.data[0].username}'s Profile`,
            config: config,
            moment: moment,
            request: request,
            profileApiData: profileApiData,
            reportApiData: reportApiData,
            features: features,
            globalImage: await getGlobalImage(),
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
                reply: reply,
                features: features,
                globalImage: await getGlobalImage(),
            });        
        }

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/user/notification/get?username=${request.params.username}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();
        
        reply.view('notifications', {
            "pageTitle": `Notifications`,
            config: config,
            apiData: apiData,
            moment: moment,
            request: request,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Punishments
    // 
    app.get('/punishments', async function(request, reply) {
        isFeatureWebRouteEnabled(features.punishments, request, reply, features);

        reply.view('punishments', {
            "pageTitle": `Punishments`,
            config: config,
            request: request,
            features: features,
            globalImage: await getGlobalImage(),
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
                reply: reply,
                features: features,
                globalImage: await getGlobalImage(),
            });        
        }
        
        isFeatureWebRouteEnabled(features.appeals, request, reply, features);

        reply.view('appeal', {
            "pageTitle": `Appeal`,
            config: config,
            request: request,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Discord Redirect
    // 
    app.get('/discord', async function(request, reply) {
        reply.redirect(config.siteConfiguration.platforms.discord)
    });

    // 
    // Shopping District Directory
    // 
    app.get('/shoppingDistrictDirectory', async function(request, reply) {
        isFeatureWebRouteEnabled(features.shops, request, reply, features);

        reply.view('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config,
            request: request,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });
    
    app.get('/shoppingDistrictDirectory/create', async function(request, reply) {
        isFeatureWebRouteEnabled(features.shops, request, reply, features);

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