export default function knowledgebaseApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/knowledgebase';

    app.get(baseEndpoint + '/section/get', async function(req, res) {
        const sectionSlug = req.query.slug;

        try {
            // Search by slug using ?slug=
            if (sectionSlug) {
                db.query(`SELECT * FROM knowledgebaseSections WHERE sectionSlug=?;`, [sectionSlug], function(error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }
    
                    // Send error is there are no kb sections.
                    if (!results.length) {
                        return res.send({
                            success: false,
                            message: `There are none`
                        });
                    }
    
                    return res.send({
                        success: true,
                        data: results
                    });
                });
            }

            // If no queries, return all.
            db.query(`SELECT * FROM knowledgebaseSections ORDER BY position ASC;`, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                // Send error is there are no kb sections.
                if (!results.length) {
                    return res.send({
                        success: false,
                        message: `There are no sections visable.`
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
        const articleSlug = req.query.slug;

        // Search for all individual article using ?slug=
        if (articleSlug) {
            try {
                db.query(`SELECT * FROM knowledgebaseArticles WHERE articleSlug=?;`, [articleSlug], function(error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }

                    // Send error is there are no kb articles.
                    if (!results.length) {
                        return res.send({
                            success: false,
                            message: `There are no articles visable.`
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

        // If there is no query, return all.
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
        const description = req.body.sectionDescription;
        const sectionIcon = req.body.sectionIcon;
        const position = req.body.sectionPosition;

        try {
            db.query(`INSERT INTO knowledgebaseSections (sectionSlug, sectionName, description, sectionIcon, position) VALUES (?, ?, ?, ?, ?)`, [sectionSlug, sectionName, description, sectionIcon, position], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
                    success: true,
                    message: `Section ${sectionName} has been successfully created.`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/section/update', async function(req, res) {
        const slug = req.body.slug;
        const sectionSlug = req.body.sectionSlug;
        const sectionName = req.body.sectionName;
        const description = req.body.sectionDescription;
        const sectionIcon = req.body.sectionIcon;
        const position = req.body.sectionPosition;

        try {
            db.query(`UPDATE knowledgebaseSections SET sectionSlug=?, sectionName=?, description=?, sectionIcon=?, position=? WHERE sectionSlug=?;`, [sectionSlug, sectionName, description, sectionIcon, position, slug], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
                    success: true,
                    message: `Section ${sectionName} has been successfully updated.`
                });
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

                return res.send({
                    success: true,
                    message: `Article called ${articleName} has been created.`
                });
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

}