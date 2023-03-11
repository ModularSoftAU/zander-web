import { getGlobalImage, hasPermission, isFeatureWebRouteEnabled } from "../../api/common";

export default function dashboardEventSiteRoute(app, client, fetch, moment, config, db, features, lang) {
    // 
    // Events
    // 
    app.get('/dashboard/events', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.events, req, res, features))
            return;
        
        if (!hasPermission('zander.web.event', req, res, features))
            return;

        const fetchURL = `${process.env.siteAddress}/api/event/get?published=all`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();
                
        res.view('dashboard/events/event-list', {
            "pageTitle": `Dashboard - Events`,
            config: config,
            apiData: apiData,
            moment: moment,
            features: features,
            req: req,
            globalImage: getGlobalImage()
        });
    });

    // 
    // Events
    // Create Event
    // 
    app.get('/dashboard/events/create', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.events, req, res, features))
            return;
        
        if (!hasPermission('zander.web.event', req, res, features))
            return;

        const fetchURL = `${process.env.siteAddress}/api/server/get?visible=all`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const serverApiData = await response.json();
                
        res.view('dashboard/events/event-editor', {
            "pageTitle": `Dashboard - Event Creator`,
            config: config,
            serverApiData: serverApiData.data,
            type: "create",
            features: features,
            req: req,
            globalImage: getGlobalImage()
        });
    });

    // 
    // Events
    // Edit an existing event
    // 
    app.get('/dashboard/events/edit', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.events, req, res, features))
            return;
        
        if (!hasPermission('zander.web.event', req, res, features))
            return;
        
        const eventId = req.query.id;
        const fetchURL = `${process.env.siteAddress}/api/event/get?id=${eventId}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const eventApiData = await response.json();

        const serverFetchURL = `${process.env.siteAddress}/api/server/get?visible=all`;
        const serverResponse = await fetch(serverFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const serverApiData = await serverResponse.json();

        res.view('dashboard/events/event-editor', {
            "pageTitle": `Dashboard - Event Editor`,
            config: config,
            eventApiData: eventApiData.data[0],
            serverApiData: serverApiData.data,
            moment: moment,
            type: "edit",
            features: features,
            req: req,
            globalImage: getGlobalImage()
        });
    });
}