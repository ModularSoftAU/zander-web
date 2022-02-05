export default function knowledgebaseSiteRoute(app, fetch, config) {

    // 
    // Knowledgebase
    // 
    app.get('/knowledgebase', async function(request, reply) {
        const sectionFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/section/get`;
        const sectionResponse = await fetch(sectionFetchURL);
        const sectionApiData = await sectionResponse.json();

        const articleFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/get`;
        const articleResponse = await fetch(articleFetchURL);
        const articleApiData = await articleResponse.json();
      
        reply.view('modules/knowledgebase/knowledgebase', {
            "pageTitle": `Knowledgebase`,
            async: true,
            config: config,
            sectionApiData: sectionApiData,
            articleApiData: articleApiData,
            request: request,
            fetch: fetch
        });
    });

    // 
    // Knowledgebase Article
    // 
    app.get('/knowledgebase/:sectionSlug/:articleSlug', async function(request, reply) {
        const sectionSlug = request.params.sectionSlug;
        const articleSlug = request.params.articleSlug;

        const articleFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/get`;
        const articleResponse = await fetch(articleFetchURL);
        const articleApiData = await articleResponse.json();

        console.log(sectionSlug);
        console.log(articleSlug);

        reply.view('modules/knowledgebase/knowledgebaseArticle', {
            "pageTitle": `Knowledgebase - KB Article Title`,
            config: config,
            request: request
        });
    });

}