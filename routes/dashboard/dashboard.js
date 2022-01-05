export default function dashbordSiteRoute(app, config) {

    // 
    // Dashboard
    // 
    app.get('/dashboard', async function(request, reply) {
        reply.render('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    app.get('/dashboard/view/network', async function(request, reply) {
        reply.render('dashboard/indexViewNetwork', {
            "pageTitle": `Dashboard`,
            config: config
        });
    });

    app.get('/dashboard/view/punishment', async function(request, reply) {
        reply.render('dashboard/indexViewPunishment', {
            "pageTitle": `Dashboard`,
            config: config
        });
    }); 

    // 
    // Player Check
    // 
    app.get('/dashboard/usercheck', async function(request, reply) {
        reply.render('dashboard/usercheck', {
            "pageTitle": `Dashboard - User Check`,
            config: config
        });
    });

}