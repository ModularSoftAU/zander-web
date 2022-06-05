import { hasPermission } from "../../api/common";

export default function dashbordSiteRoute(app, config, features, lang) {

    // 
    // Dashboard
    // 
    app.get('/dashboard', async function(request, reply) {
        hasPermission('zander.web.dashboard', request, reply);

        reply.view('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config,
            features: features
        });
    });

    app.get('/dashboard/view/network', async function(request, reply) {
        hasPermission('zander.web.dashboard', request, reply);

        reply.view('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config,
            features: features
        });
    });

    app.get('/dashboard/view/punishment', async function(request, reply) {
        hasPermission('zander.web.dashboard', request, reply);

        reply.view('dashboard/indexViewPunishment', {
            "pageTitle": `Dashboard`,
            config: config,
            features: features
        });
    }); 

    // 
    // Player Check
    // 
    app.get('/dashboard/user/check', async function(request, reply) {
        hasPermission('zander.web.moderation.user', request, reply);

        reply.view('dashboard/usercheck', {
            "pageTitle": `Dashboard - User Check`,
            config: config,
            features: features
        });
    });

}