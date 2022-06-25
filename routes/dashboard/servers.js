import { hasPermission, isFeatureWebRouteEnabled } from "../../api/common";

export default function dashboardServersSiteRoute(app, fetch, config, db, features, lang) {
    // 
    // Servers
    // 
    app.get('/dashboard/servers', async function(request, reply) {
        if (!isFeatureWebRouteEnabled(features.servers, request, reply))
            return;
        
        if (!hasPermission('zander.web.server', request, reply))
            return;

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        reply.view('dashboard/servers/list', {
            "pageTitle": `Dashboard - Servers`,
            config: config,
            apiData: apiData,
            features: features
        });
    });

    app.get('/dashboard/servers/create', async function(request, reply) {
        if (!isFeatureWebRouteEnabled(features.servers, request, reply))
            return;
        
        if (!hasPermission('zander.web.server', request, reply))
            return;
        
        reply.view('dashboard/servers/editor', {
            "pageTitle": `Dashboard - Server Creator`,
            config: config,
            type: "create",
            features: features
        });
    });

    app.get('/dashboard/servers/edit', async function(request, reply) {
        if (!isFeatureWebRouteEnabled(features.servers, request, reply))
            return;
        
        if (!hasPermission('zander.web.server', request, reply))
            return;
        
        const id = request.query.id;
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?id=${id}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const serverApiData = await response.json();

        reply.view('dashboard/servers/editor', {
            "pageTitle": `Dashboard - Server Editor`,
            config: config,
            serverApiData: serverApiData.data[0],
            type: "edit",
            features: features
        });
    });

}