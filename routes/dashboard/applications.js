import { hasPermission, isFeatureWebRouteEnabled } from "../../api/common";

export default function dashboardApplicationsSiteRoute(app, fetch, config, features, lang) {

    // 
    // Applications
    // 
    app.get('/dashboard/applications', async function(request, reply) {
        // isFeatureWebRouteEnabled(features.applications, request, reply);
        hasPermission('zander.web.application', request, reply);

        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();

        reply.view('dashboard/applications/list', {
            "pageTitle": `Dashboard - Applications`,
            config: config,
            apiData: apiData,
            features: features
        });
    });

    app.get('/dashboard/applications/create', async function(request, reply) {
        // isFeatureWebRouteEnabled(features.application, request, reply);
        hasPermission('zander.web.application', request, reply);

        reply.view('dashboard/applications/editor', {
            "pageTitle": `Dashboard - Application Creator`,
            config: config,
            type: "create",
            features: features
        });
    });

    app.get('/dashboard/applications/edit', async function(request, reply) {
        // isFeatureWebRouteEnabled(features.applications, request, reply);
        hasPermission('zander.web.application', request, reply);

        const id = request.query.id;
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/get?id=${id}`;
        const response = await fetch(fetchURL);
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