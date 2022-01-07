export default function dashboardKnowledgebaseSiteRoute(app, fetch, moment, config) {

    // 
    // Knowledgebase
    // 
    app.get('/dashboard/knowledgebase', async function(request, reply) {
        // KB Article Data
        const articleFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/get`;
        const articleResponse = await fetch(articleFetchURL);
        const articleApiData = await articleResponse.json();

        // KB Section Data
        const sectionFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/section/get`;
        const sectionResponse = await fetch(sectionFetchURL);
        const sectionApiData = await sectionResponse.json();
      
        reply.view('dashboard/knowledgebase/list', {
            "pageTitle": `Dashboard - Knowledgebase`,
            config: config,
            articleApiData: articleApiData,
            sectionApiData: sectionApiData
        });
    });

    app.get('/dashboard/knowledgebase/create/section', async function(request, reply) {
        reply.view('dashboard/knowledgebase/createSection', {
            "pageTitle": `Dashboard - Create Knowledgebase Section`,
            config: config
        });
    });

    app.get('/dashboard/knowledgebase/create/article', async function(request, reply) {
        reply.view('dashboard/knowledgebase/createArticle', {
            "pageTitle": `Dashboard - Create Knowledgebase Article`,
            config: config
        });
    });

}