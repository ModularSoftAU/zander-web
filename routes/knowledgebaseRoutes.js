export default function knowledgebaseSiteRoute(app, config) {

    // 
    // Knowledgebase
    // 
    app.get('/knowledgebase', async function(request, reply) {
        reply.view('modules/knowledgebase/knowledgebase', {
            "pageTitle": `Knowledgebase`,
            config: config
        });
    });

    app.get('/support', async function(request, reply) {
        reply.view('modules/knowledgebase/knowledgebase', {
            "pageTitle": `Knowledgebase`,
            config: config
        });
    });

    app.get('/help', async function(request, reply) {
        reply.view('modules/knowledgebase/knowledgebase', {
            "pageTitle": `Knowledgebase`,
            config: config
        });
    });

    // 
    // Knowledgebase Article
    // 
    app.get('/generalStaff/newStaff', async function(request, reply) {
        reply.view('modules/knowledgebase/knowledgebaseArticle', {
            "pageTitle": `Knowledgebase - KB Article Title`,
            config: config
        });
    });

}