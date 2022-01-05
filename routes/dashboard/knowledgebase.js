export default function dashboardKnowledgebaseSiteRoute(app, config) {

    // 
    // Knowledgebase
    // 
    app.get('/dashboard/knowledgebase', async function(request, reply) {
        reply.render('dashboard/knowledgebase/list', {
            "pageTitle": `Dashboard - Knowledgebase`,
            config: config
        });
    });

    app.get('/dashboard/knowledgebase/create/section', async function(request, reply) {
        reply.render('dashboard/knowledgebase/createSection', {
            "pageTitle": `Dashboard - Create Knowledgebase Section`,
            config: config
        });
    });

    app.get('/dashboard/knowledgebase/create/article', async function(request, reply) {
        reply.render('dashboard/knowledgebase/createArticle', {
            "pageTitle": `Dashboard - Create Knowledgebase Article`,
            config: config
        });
    });

}