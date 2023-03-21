import moment from "moment/moment";
import fetch from "node-fetch";
import { getGlobalImage, hasPermission } from "../../api/common";

export default function dashbordSiteRoute(app, config, features, lang) {

    // 
    // Dashboard
    // 
    app.get('/dashboard', async function (req, res) {
        if (!hasPermission('zander.web.dashboard', req, res, features))
            return;

        res.view('dashboard/dashboard-index', {
            "pageTitle": `Dashboard`,
            config: config,
            features: features,
            req: req,
            globalImage: await getGlobalImage()
        });
    });

    // 
    // Logs
    // 
    app.get('/dashboard/logs', async function (req, res) {
        if (!hasPermission('zander.web.logs', req, res, features))
            return;

        const fetchURL = `${process.env.siteAddress}/api/web/logs/get`;
        const response = await fetch(fetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const apiData = await response.json();

        res.view('dashboard/logs', {
            "pageTitle": `Dashboard - Logs`,
            config: config,
            apiData: apiData,
            features: features,
            req: req,
            globalImage: getGlobalImage(),
            moment: moment
        });
    });

    // 
    // Player Check
    // 
    app.get('/dashboard/user/check', async function (req, res) {
        if (!hasPermission('zander.web.moderation.user', req, res, features))
            return;

        res.view('dashboard/usercheck', {
            "pageTitle": `Dashboard - User Check`,
            config: config,
            features: features
        });
    });

}