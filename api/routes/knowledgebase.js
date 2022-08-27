import {isFeatureEnabled, required, optional} from '../common'

export default function knowledgebaseApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/knowledgebase';

    // TODO: Update docs
    app.get(baseEndpoint + '/section/get', async function(req, res) {
        isFeatureEnabled(features.knowledgebase, res, features, lang);
        const sectionSlug = optional(req.query, "slug");

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
                            message: lang.knowledgebase.noSections
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
                        message: lang.knowledgebase.noSections
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
        isFeatureEnabled(features.knowledgebase, res, features, lang);
        const articleSlug = optional(req.query, "slug");

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
                            message: lang.knowledgebase.noArticles
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
        isFeatureEnabled(features.knowledgebase, res, features, lang);
        const sectionSlug = required(req.body, "sectionSlug", res);
        const sectionName = required(req.body, "sectionName", res);
        const sectionDescription = required(req.body, "sectionDescription", res);
        const sectionIcon = required(req.body, "sectionIcon", res);
        const sectionPosition = required(req.body, "sectionPosition", res);

        const sectionCreatedLang = lang.knowledgebase.sectionCreated

        try {
            db.query(`INSERT INTO knowledgebaseSections (sectionSlug, sectionName, description, sectionIcon, position) VALUES (?, ?, ?, ?, ?)`, [sectionSlug, sectionName, sectionDescription, sectionIcon, sectionPosition], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
                    success: true,
                    alertType: "success",
                    content: sectionCreatedLang.replace("%SECTIONNAME%", sectionName)
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
        isFeatureEnabled(features.knowledgebase, res, features, lang);
        const slug = required(req.body, "slug", res);
        const sectionSlug = required(req.body, "sectionSlug", res);
        const sectionName = required(req.body, "sectionName", res);
        const sectionDescription = required(req.body, "sectionDescription", res);
        const sectionIcon = required(req.body, "sectionIcon", res);
        const sectionPosition = required(req.body, "sectionPosition", res);

        const sectionUpdatedLang = lang.knowledgebase.sectionUpdated

        try {
            db.query(`UPDATE knowledgebaseSections SET sectionSlug=?, sectionName=?, description=?, sectionIcon=?, position=? WHERE sectionSlug=?;`, [sectionSlug, sectionName, sectionDescription, sectionIcon, sectionPosition, slug], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
                    success: true,
                    message: sectionUpdatedLang.replace("%SECTIONNAME%", sectionName)
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
        isFeatureEnabled(features.knowledgebase, res, features, lang);
        const articleSlug = required(req.body, "articleSlug", res);
        const articleName = required(req.body, "articleName", res);
        const articleDescription = required(req.body, "articleDescription", res);
        const articleLink = required(req.body, "articleLink", res);
        const articleSection = required(req.body, "articleSection", res);
        const articlePosition = required(req.body, "articlePosition", res);
        const articleVisibility = required(req.body, "articleVisibility", res);

        const articleCreatedLang = lang.knowledgebase.articleCreated

        try {
            db.query(`
            INSERT INTO knowledgebaseArticles 
                (sectionId, articleSlug, articleName, articleDescription, articleLink, position, published) 
            VALUES 
                ((SELECT sectionId FROM knowledgebaseSections WHERE sectionId=?), ?, ?, ?, ?, ?, ?)
            `, [articleSection, articleSlug, articleName, articleDescription, articleLink, articlePosition, articleVisibility], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: articleCreatedLang.replace("%ARTICLENAME%", articleName)
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
        isFeatureEnabled(features.knowledgebase, res, features, lang);
                
        const slug = required(req.body, "slug", res);
        const articleSlug = required(req.body, "articleSlug", res);
        const articleName = required(req.body, "articleName", res);
        const articleDescription = required(req.body, "articleDescription", res);
        const articleLink = required(req.body, "articleLink", res);
        const articleSection = required(req.body, "articleSection", res);
        const articlePosition = required(req.body, "articlePosition", res);
        const articleVisibility = required(req.body, "articleVisibility", res);

        const articleUpdatedLang = lang.knowledgebase.articleUpdated

        console.log(articleSection);

        try {
            db.query(`
                UPDATE knowledgebaseArticles SET 
                    articleSlug=?, 
                    articleName=?, 
                    articleDescription=?, 
                    articleLink=?, 
                    sectionId=?, 
                    position=?, 
                    published=? 
                WHERE articleSlug=?`, 
                [articleSlug, articleName, articleDescription, articleLink, articleSection, articlePosition, articleVisibility, slug], function(error, results, fields) {
                
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: articleUpdatedLang.replace("%ARTICLENAME%", articleName)
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

}