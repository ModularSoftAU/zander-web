import { isFeatureWebRouteEnabled, getGlobalImage } from "../api/common";

export default function knowledgebaseSiteRoute(app, client, fetch, moment, config, db, features, lang) {

    // 
    // Knowledgebase
    // 
    app.get('/knowledgebase', async function (req, reply) {
        if (!isFeatureWebRouteEnabled(features.knowledgebase, req, reply, features))
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
            req: req,
            fetch: fetch,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

    // 
    // Knowledgebase Article
    // 
    app.get('/knowledgebase/:sectionSlug/:articleSlug', async function (req, reply) {
        if (!isFeatureWebRouteEnabled(features.knowledgebase, req, reply, features))
            return;
        
        const sectionSlug = req.params.sectionSlug;
        const articleSlug = req.params.articleSlug;

        const articleFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/get?articleSlug=${articleSlug}`;
        const articleResponse = await fetch(articleFetchURL, {
            headers: { 'x-access-token': process.env.apiKey }
        });
        const articleApiData = await articleResponse.json();

        reply.view('modules/knowledgebase/knowledgebaseArticle', {
            "pageTitle": articleApiData.data[0].articleName,
            config: config,
            articleApiData: articleApiData,
            req: req,
            features: features,
            globalImage: await getGlobalImage(),
        });
    });

}