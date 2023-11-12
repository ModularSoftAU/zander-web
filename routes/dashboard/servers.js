import { getGlobalImage, hasPermission, isFeatureWebRouteEnabled } from "../../api/common";
import { getWebAnnouncement } from "../../controllers/announcementController";

export default function dashboardServersSiteRoute(app, fetch, config, db, features, lang) {
    // 
    // Servers
    // 
    app.get('/dashboard/servers', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.server, req, res, features))
            return;
        
        if (!hasPermission('zander.web.server', req, res, features))
            return;

        const fetchURL = `${process.env.siteAddress}/api/server/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        res.view('dashboard/servers/server-list', {
            "pageTitle": `Dashboard - Servers`,
            config: config,
            apiData: apiData,
            features: features,
            req: req,
            globalImage: getGlobalImage(),
            announcementWeb: await getWebAnnouncement()
        });

        return res;
    });

    app.get('/dashboard/servers/create', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.server, req, res, features))
            return;
        
        if (!hasPermission('zander.web.server', req, res, features))
            return;
                
        res.view('dashboard/servers/server-editor', {
            "pageTitle": `Dashboard - Server Creator`,
            config: config,
            type: "create",
            features: features,
            globalImage: getGlobalImage(),
            req: req,
            announcementWeb: await getWebAnnouncement()
        });

        return res;
    });

    app.get('/dashboard/servers/edit', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.server, req, res, features))
            return;
        
        if (!hasPermission('zander.web.server', req, res, features))
            return;
        
        const id = req.query.id;
        const fetchURL = `${process.env.siteAddress}/api/server/get?id=${id}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const serverApiData = await response.json();

        res.view('dashboard/servers/server-editor', {
            "pageTitle": `Dashboard - Server Editor`,
            config: config,
            serverApiData: serverApiData.data[0],
            type: "edit",
            features: features,
            globalImage: getGlobalImage(),
            req: req,
            announcementWeb: await getWebAnnouncement()
        });

        return res;
    });

}