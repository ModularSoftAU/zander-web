import { hasPermission, isFeatureWebRouteEnabled } from "../../api/common";

export default function dashboardApplicationsSiteRoute(app, fetch, config, db, features, lang) {

    // 
    // Applications
    // 
    app.get('/dashboard/applications', async function (req, reply) {
        if (!isFeatureWebRouteEnabled(features.applications, req, reply, features))
            return;
        
        if (!hasPermission('zander.web.application', req, reply, features))
            return;

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        reply.view('dashboard/applications/list', {
            "pageTitle": `Dashboard - Applications`,
            config: config,
            apiData: apiData,
            features: features,
            req: req
        });
    });

    app.get('/dashboard/applications/create', async function (req, reply) {
        if (!isFeatureWebRouteEnabled(features.applications, req, reply, features))
            return;

        if (!hasPermission('zander.web.application', req, reply, features))
            return;

        reply.view('dashboard/applications/editor', {
            "pageTitle": `Dashboard - Application Creator`,
            config: config,
            type: "create",
            features: features
        });
    });

    app.get('/dashboard/applications/edit', async function (req, reply) {
        if (!isFeatureWebRouteEnabled(features.applications, req, reply, features))
            return;
        
        if (!hasPermission('zander.web.application', req, reply, features))
            return;

        const id = req.query.id;
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get?id=${id}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const applicationApiData = await response.json();

        reply.view('dashboard/applications/editor', {
            "pageTitle": `Dashboard - Application Editor`,
            config: config,
            applicationApiData: applicationApiData.data[0],
            type: "edit",
            features: features
        });
    });

}