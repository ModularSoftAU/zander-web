import dashboardSiteRoutes from './dashboard'
import knowledgebaseSiteRoutes from './knowledgebaseRoutes'
import policySiteRoutes from './policyRoutes'
import communityCreationsRoutes from './communityCreationsRoutes'
import sessionRoutes from './sessionRoutes'
import userRoutes from './userRoutes'
import { isFeatureWebRouteEnabled, isLoggedIn, getGlobalImage, setBannerCookie } from "../api/common";
import { getProfilePicture } from '../controllers/userController'
import emojis from "../emojis.json" assert {type: "json"};

export default function applicationSiteRoutes(app, client, fetch, moment, config, db, features, lang) {

    dashboardSiteRoutes(app, client, fetch, moment, config, db, features, lang);
    knowledgebaseSiteRoutes(app, client, fetch, moment, config, db, features, lang);
    communityCreationsRoutes(app, client, fetch, moment, config, db, features, lang);
    sessionRoutes(app, client, fetch, moment, config, db, features, lang);
    userRoutes(app, client, fetch, moment, config, db, features, lang);
    policySiteRoutes(app, config, features);

    app.get('/', async function (req, res) {
        const fetchURL = `${process.env.siteAddress}/api/web/statistics`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const statApiData = await response.json();

        return res.view("modules/index/index", {
            "pageTitle": `${config.siteConfiguration.siteName}`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
            statApiData: statApiData
        });
    });

    // 
    // Play
    // 
    app.get('/play', async function (req, res) {
        isFeatureWebRouteEnabled(features.servers, req, res, features);

        const fetchURL = `${process.env.siteAddress}/api/server/get?visible=true`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        return res.view('modules/play/play', {
            "pageTitle": `Play`,
            config: config,
            req: req,
            apiData: apiData,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Apply
    // 
    app.get('/apply', async function (req, res) {
        isFeatureWebRouteEnabled(features.applications, req, res, features);

        const fetchURL = `${process.env.siteAddress}/api/application/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        res.view('apply', {
            "pageTitle": `Apply`,
            config: config,
            req: req,
            apiData: apiData,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Events
    // 
    app.get('/events', async function (req, res) {
        isFeatureWebRouteEnabled(features.events, req, res, features);

        const fetchURL = `${process.env.siteAddress}/api/event/get?published=show`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        res.view('events', {
            "pageTitle": `Events`,
            config: config,
            apiData: apiData,
            moment: moment,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Vote
    // 
    app.get('/vote', async function (req, res) {
        const fetchURL = `${process.env.siteAddress}/api/vote/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        res.view('vote', {
            "pageTitle": `Vote`,
            config: config,
            req: req,
            features: features,
            apiData: apiData,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Staff
    // 
    app.get('/staff', async function (req, res) {
        res.view('staff', {
            "pageTitle": `Staff`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Report
    // 
    app.get('/report', async function (req, res) {
        isFeatureWebRouteEnabled(features.report, req, res, features);

        if (!isLoggedIn(req)) {
            return res.view('session/notLoggedIn', {
                "pageTitle": `Access Restricted`,
                config: config,
                req: req,
                res: res,
                features: features,
                globalImage: await getGlobalImage(),
            });        
        }

        const fetchURL = `${process.env.siteAddress}/api/server/get?visable=true`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const serverApiData = await response.json();

        if (!serverApiData.success) {
            res.view('session/error', {
                "pageTitle": `Server Error`,
                config: config,
                error: lang.error.noReportServers,
                req: req,
                features: features,
                globalImage: await getGlobalImage(),
            });
        }

        res.view('report', {
            "pageTitle": `Report a Player`,
            config: config,
            req: req,
            serverApiData: serverApiData.data,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Report Specific
    // 
    app.get('/report/:id', async function (req, res) {
        isFeatureWebRouteEnabled(features.report, req, res, features);

        const fetchURL = `${process.env.siteAddress}/api/report/get?reportId=${req.params.id}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        res.view('reportView', {
            "pageTitle": `#${req.params.id} Report Card`,
            config: config,
            req: req,
            moment: moment,
            apiData: apiData,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Profile
    // 
    app.get('/profile/:username', async function (req, res) {
        isFeatureWebRouteEnabled(features.web.profiles, req, res, features);

        // Get Player Profile Information
        const profileFetchURL = `${process.env.siteAddress}/api/user/get?username=${req.params.username}`;
        const profileResponse = await fetch(profileFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const profileApiData = await profileResponse.json();

        // Get Player Report Information
        const reportFetchURL = `${process.env.siteAddress}/api/report/get?username=${req.params.username}`;
        const reportResponse = await fetch(reportFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const reportApiData = await reportResponse.json();

        res.view('modules/profile/profile', {
            "pageTitle": `${profileApiData.data[0].username}'s Profile`,
            config: config,
            moment: moment,
            req: req,
            profileApiData: profileApiData,
            reportApiData: reportApiData,
            features: features,
            globalImage: await getGlobalImage(),
            profilePicture: await getProfilePicture(profileApiData.data[0].username)
        });
    });

    // 
    // Profile Editor
    // 
    app.get('/profile/edit', async function (req, res) {
        isFeatureWebRouteEnabled(features.web.profileEditor, req, res, features);

        // Get Player Profile Information
        const profileFetchURL = `${process.env.siteAddress}/api/user/get?username=${req.session.user.username}`;
        const profileResponse = await fetch(profileFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const profileApiData = await profileResponse.json();

        console.log(profileApiData.data[0].username);

        res.view('modules/profile/profile-editor', {
            "pageTitle": `${req.session.user.username}'s Profile`,
            config: config,
            moment: moment,
            req: req,
            profileApiData: profileApiData,
            features: features,
            globalImage: await getGlobalImage(),
            profilePicture: await getProfilePicture(profileApiData.data[0].username)
        });
    });


    // 
    // User Notifications
    // 
    app.get('/notifications', async function (req, res) {
        if (!isLoggedIn(req)) {
            return res.view('session/notLoggedIn', {
                "pageTitle": `Access Restricted`,
                config: config,
                req: req,
                res: res,
                features: features,
                globalImage: await getGlobalImage(),
            });        
        }

        const fetchURL = `${process.env.siteAddress}/api/user/notification/get?username=${req.params.username}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();
        
        res.view('notifications', {
            "pageTitle": `Notifications`,
            config: config,
            apiData: apiData,
            moment: moment,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Punishments
    // 
    app.get('/punishments', async function (req, res) {
        isFeatureWebRouteEnabled(features.punishment, req, res, features);

        res.view('punishments', {
            "pageTitle": `Punishments`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Appeal
    // 
    app.get('/appeal', async function (req, res) {
        if (!isLoggedIn(req)) {
            return res.view('session/notLoggedIn', {
                "pageTitle": `Access Restricted`,
                config: config,
                req: req,
                res: res,
                features: features,
                globalImage: await getGlobalImage(),
            });        
        }
        
        isFeatureWebRouteEnabled(features.appeals, req, res, features);

        res.view('appeal', {
            "pageTitle": `Appeal`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Discord Redirect
    // 
    app.get('/discord', async function (req, res) {
        res.redirect(config.siteConfiguration.platforms.discord)
    });

    // 
    // Shopping District Directory
    // 
    app.get('/shoppingDistrictDirectory', async function (req, res) {
        isFeatureWebRouteEnabled(features.shops, req, res, features);

        res.view('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
            "pageTitle": `Shopping District Directory`,
            config: config,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });
    
    app.get('/shoppingDistrictDirectory/create', async function (req, res) {
        isFeatureWebRouteEnabled(features.shops, req, res, features);

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

        //     res.view('modules/shoppingDistrictDirectory/create', {
        //         "pageTitle": `Shopping District Directory`,
        //         config: config,
        //         minecraftItem: files
        //     });
        // });
    });

    app.get('/emojis', async function (req, res) {
        // There is no isFeatureEnabled() due to being a critical endpoint.

        return res.send(emojis);
    });
}