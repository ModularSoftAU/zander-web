export default function dashboardKnowledgebaseSiteRoute(app, fetch, moment, config, db) {

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

    app.get('/dashboard/knowledgebase/section/create', async function(request, reply) {
        reply.view('dashboard/knowledgebase/sectionEditor', {
            "pageTitle": `Dashboard - Create Knowledgebase Section`,
            config: config,
            type: "create"
        });
    });

    app.post('/dashboard/knowledgebase/section/delete', async function(req, res) {
        const sectionSlug = req.body.sectionSlug;

        try {
            db.query(`DELETE FROM knowledgebaseSections WHERE sectionSlug = ?;`, [sectionSlug], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
              return res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/knowledgebase`)
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.get('/dashboard/knowledgebase/article/create', async function(request, reply) {
        reply.view('dashboard/knowledgebase/articleEditor', {
            "pageTitle": `Dashboard - Create Knowledgebase Article`,
            config: config,
            type: "create"
        });
    });

    app.post('/dashboard/knowledgebase/article/delete', async function(req, res) {
        const articleSlug = req.body.articleSlug;

        try {
            db.query(`DELETE FROM knowledgebaseArticles WHERE articleSlug = ?;`, [articleSlug], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
              return res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/knowledgebase`);
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

}