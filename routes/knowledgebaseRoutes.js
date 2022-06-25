import { isFeatureWebRouteEnabled } from "../api/common";

export default function knowledgebaseSiteRoute(app, fetch, config, features, lang) {

    // 
    // Knowledgebase
    // 
    app.get('/knowledgebase', async function(request, reply) {
        if (!isFeatureWebRouteEnabled(features.knowledgebase, request, reply))
            return;

        const sectionFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/section/get`;
        const sectionResponse = await fetch(sectionFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const sectionApiData = await sectionResponse.json();

        const articleFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/get`;
        const articleResponse = await fetch(articleFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const articleApiData = await articleResponse.json();
      
        reply.view('modules/knowledgebase/knowledgebase', {
            "pageTitle": `Knowledgebase`,
            async: true,
            config: config,
            sectionApiData: sectionApiData,
            articleApiData: articleApiData,
            request: request,
            fetch: fetch,
            features: features
        });
    });

    // 
    // Knowledgebase Article
    // 
    app.get('/knowledgebase/:sectionSlug/:articleSlug', async function(request, reply) {
        if (!isFeatureWebRouteEnabled(features.knowledgebase, request, reply))
            return;
        
        const sectionSlug = request.params.sectionSlug;
        const articleSlug = request.params.articleSlug;

        const articleFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/get?articleSlug=${articleSlug}`;
        const articleResponse = await fetch(articleFetchURL);
        const articleApiData = await articleResponse.json();

        reply.view('modules/knowledgebase/knowledgebaseArticle', {
            "pageTitle": articleApiData.data[0].articleName,
            config: config,
            articleApiData: articleApiData,
            request: request,
            features: features
        });
    });

}