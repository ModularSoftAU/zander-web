import { hasPermission, isFeatureWebRouteEnabled } from "../../api/common";

export default function dashboardAnnouncementSiteRoute(app, fetch, config, db, features, lang) {
    // 
    // Servers
    // 
    app.get('/dashboard/announcements', async function(request, reply) {
        if (!isFeatureWebRouteEnabled(features.announcements, request, reply, features))
            return;
        
        if (!hasPermission('zander.web.announcements', request, reply, features))
            return;

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcements/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        console.log(apiData);

        reply.view('dashboard/announcements/list', {
            "pageTitle": `Dashboard - Announcements`,
            config: config,
            apiData: apiData,
            features: features,
            request: request
        });
    });

    app.get('/dashboard/announcements/create', async function(request, reply) {
        if (!isFeatureWebRouteEnabled(features.announcements, request, reply, features))
            return;
        
        if (!hasPermission('zander.web.announcements', request, reply, features))
            return;
                
        reply.view('dashboard/announcements/editor', {
            "pageTitle": `Dashboard - Announcement Creator`,
            config: config,
            type: "create",
            features: features
        });
    });

    app.get('/dashboard/announcements/edit', async function(request, reply) {
        if (!isFeatureWebRouteEnabled(features.announcements, request, reply, features))
            return;
        
        if (!hasPermission('zander.web.announcements', request, reply, features))
            return;
        
        const id = request.query.id;
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcement/get?id=${id}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const serverApiData = await response.json();

        reply.view('dashboard/announcements/editor', {
            "pageTitle": `Dashboard - Announcement Editor`,
            config: config,
            serverApiData: serverApiData.data[0],
            type: "edit",
            features: features
        });
    });

}