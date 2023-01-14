import { hasPermission, isFeatureWebRouteEnabled } from "../../api/common";

export default function dashboardAnnouncementSiteRoute(app, fetch, config, db, features, lang) {
    // 
    // Servers
    // 
    app.get('/dashboard/announcements', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.announcements, req, res, features))
            return;
        
        if (!hasPermission('zander.web.announcements', req, res, features))
            return;

        const fetchURL = `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/announcement/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();
        
        res.view('dashboard/announcements/list', {
            "pageTitle": `Dashboard - Announcements`,
            config: config,
            apiData: apiData,
            features: features,
            req: req
        });
    });

    app.get('/dashboard/announcements/create', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.announcements, req, res, features))
            return;
        
        if (!hasPermission('zander.web.announcements', req, res, features))
            return;
                
        res.view('dashboard/announcements/editor', {
            "pageTitle": `Dashboard - Announcement Creator`,
            config: config,
            type: "create",
            features: features
        });
    });

    app.get('/dashboard/announcements/edit', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.announcements, req, res, features))
            return;
        
        if (!hasPermission('zander.web.announcements', req, res, features))
            return;
        
        const announcementSlug = req.query.announcementSlug;
        const fetchURL = `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/announcement/get?announcementSlug=${announcementSlug}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const announcementApiData = await response.json();

        res.view('dashboard/announcements/editor', {
            "pageTitle": `Dashboard - Announcement Editor`,
            config: config,
            announcementApiData: announcementApiData.data[0],
            type: "edit",
            features: features
        });
    });

}