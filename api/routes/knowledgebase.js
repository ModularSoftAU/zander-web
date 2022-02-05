export default function knowledgebaseApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/knowledgebase';

    // Jaedan: Some get routes should be added for the knowledgebase
    // Data goes in but none comes out currently
    app.get(baseEndpoint + '/section/get', async function(req, res) {
        try {
            db.query(`SELECT * FROM knowledgebaseSections ORDER BY position ASC;`, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.get(baseEndpoint + '/article/get', async function(req, res) {
        const sectionSlug = req.query.sectionSlug;

        // Search for all articles by section slug
        if (sectionSlug) {
            try {
                db.query(`SELECT * FROM knowledgebaseArticles WHERE sectionId=(SELECT sectionId FROM knowledgebasesections WHERE sectionSlug=?) ORDER BY position ASC;`, [sectionSlug], function(error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }
                    return res.send({
                        success: true,
                        data: results
                    });
                });
    
            } catch (error) {
                res.send({
                    success: false,
                    message: `${error}`
                });
            }            
        }

        try {
            db.query(`SELECT * FROM knowledgebaseArticles ORDER BY position ASC;`, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/section/create', async function(req, res) {
        const sectionSlug = req.body.sectionSlug;
        const sectionName = req.body.sectionName;
        const description = req.body.description;
        const sectionIcon = req.body.sectionIcon;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO knowledgebaseSections (sectionSlug, sectionName, description, sectionIcon, position) VALUES (?, ?, ?, ?, ?)`, [sectionSlug, sectionName, description, sectionIcon, position], function(error, results, fields) {
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

    app.post(baseEndpoint + '/section/update', async function(req, res) {
        const sectionSlug = req.body.sectionSlug;
        const sectionName = req.body.sectionName;
        const description = req.body.description;
        const sectionIcon = req.body.sectionIcon;
        const position = req.body.position;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/section/delete', async function(req, res) {
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

    app.post(baseEndpoint + '/article/create', async function(req, res) {
        const articleSlug = req.body.articleSlug;
        const articleName = req.body.articleName;
        const articleLink = req.body.articleLink;
        const articleSection = req.body.articleSection;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO knowledgebaseArticles (articleSlug, articleName, articleLink, sectionId, position) VALUES (?, ?, ?, (select sectionId from knowledgebaseSections where sectionSlug=?), ?)`, [articleSlug, articleName, articleLink, articleSection, position], function(error, results, fields) {
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

    app.post(baseEndpoint + '/article/update', async function(req, res) {
        const articleSlug = req.body.articleSlug;
        const articleName = req.body.articleName;
        const articleLink = req.body.articleLink;
        const section = req.body.section;
        const position = req.body.position;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/article/delete', async function(req, res) {
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