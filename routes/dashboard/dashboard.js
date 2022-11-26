import { hasPermission } from "../../api/common";

export default function dashbordSiteRoute(app, config, features, lang) {

    // 
    // Dashboard
    // 
    app.get('/dashboard', async function (req, reply) {
        if (!hasPermission('zander.web.dashboard', req, reply, features))
            return;

        reply.view('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config,
            features: features
        });
    });

    app.get('/dashboard/view/network', async function (req, reply) {
        if (!hasPermission('zander.web.dashboard', req, reply, features))
            return;

        reply.view('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config,
            features: features
        });
    });

    app.get('/dashboard/view/punishment', async function (req, reply) {
        if (!hasPermission('zander.web.dashboard', req, reply, features))
            return;

        reply.view('dashboard/indexViewPunishment', {
            "pageTitle": `Dashboard`,
            config: config,
            features: features
        });
    }); 

    // 
    // Player Check
    // 
    app.get('/dashboard/user/check', async function (req, reply) {
        if (!hasPermission('zander.web.moderation.user', req, reply, features))
            return;

        reply.view('dashboard/usercheck', {
            "pageTitle": `Dashboard - User Check`,
            config: config,
            features: features
        });
    });

}