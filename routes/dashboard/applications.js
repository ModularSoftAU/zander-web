import { getGlobalImage, hasPermission, isFeatureWebRouteEnabled } from "../../api/common";

export default function dashboardApplicationsSiteRoute(app, fetch, config, db, features, lang) {

    // 
    // Applications
    // 
    app.get('/dashboard/applications', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
            return;
        
        if (!hasPermission('zander.web.application', req, res, features))
            return;

        const fetchURL = `${process.env.siteAddress}/api/application/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        res.view('dashboard/applications/application-list', {
            "pageTitle": `Dashboard - Applications`,
            config: config,
            apiData: apiData,
            features: features,
            req: req,
            globalImage: getGlobalImage()
        });

        return res;
    });

    app.get('/dashboard/applications/create', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
            return;

        if (!hasPermission('zander.web.application', req, res, features))
            return;

        res.view('dashboard/applications/application-editor', {
            "pageTitle": `Dashboard - Application Creator`,
            config: config,
            type: "create",
            features: features,
            req: req,
            globalImage: getGlobalImage()
        });

        return res;
    });

    app.get('/dashboard/applications/edit', async function (req, res) {
        if (!isFeatureWebRouteEnabled(features.applications, req, res, features))
            return;
        
        if (!hasPermission('zander.web.application', req, res, features))
            return;

        const id = req.query.id;
        const fetchURL = `${process.env.siteAddress}/api/application/get?id=${id}`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const applicationApiData = await response.json();

        res.view('dashboard/applications/application-editor', {
            "pageTitle": `Dashboard - Application Editor`,
            config: config,
            applicationApiData: applicationApiData.data[0],
            type: "edit",
            features: features,
            req: req,
            globalImage: getGlobalImage()
        });

        return res;
    });

}