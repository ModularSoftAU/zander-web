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

    app.get('/dashboard/logs', async function (req, res) {
        if (!hasPermission('zander.web.logs', req, res, features))
            return;

        res.view('dashboard/log', {
            "pageTitle": `Logs`,
            config: config,
            features: features,
            req: req,
            globalImage: getGlobalImage()
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