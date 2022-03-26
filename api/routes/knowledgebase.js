import {isFeatureEnabled, required, optional} from '../common'

export default function knowledgebaseApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/knowledgebase';

    // TODO: Update docs
    app.get(baseEndpoint + '/section/get', async function(req, res) {
        isFeatureEnabled(features.knowledgebase, res, lang);
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
        isFeatureEnabled(features.knowledgebase, res, lang);
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
        isFeatureEnabled(features.knowledgebase, res, lang);
        const sectionSlug = required(req.body, "sectionSlug", res);
        const sectionName = required(req.body, "sectionName", res);
        const description = required(req.body, "description", res);
        const sectionIcon = required(req.body, "sectionIcon", res);
        const position = required(req.body, "position", res);

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
        isFeatureEnabled(features.knowledgebase, res, lang);
        const slug = required(req.body, "slug", res);
        const sectionSlug = required(req.body, "sectionSlug", res);
        const sectionName = required(req.body, "sectionName", res);
        const description = required(req.body, "description", res);
        const sectionIcon = required(req.body, "sectionIcon", res);
        const position = required(req.body, "position", res);

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
        isFeatureEnabled(features.knowledgebase, res, lang);
        const articleSlug = required(req.body, "articleSlug", res);
        const articleName = required(req.body, "articleName", res);
        const articleDescription = required(req.body, "articleDescription", res);
        const articleLink = required(req.body, "articleLink", res);
        const articleSection = required(req.body, "articleSection", res);
        const position = required(req.body, "position", res);
        const published = required(req.body, "published", res);

        try {
            db.query(`INSERT INTO knowledgebaseArticles (articleSlug, articleName, articleDescription, articleLink, sectionId, position, published) VALUES (?, ?, ?, ?, (select sectionId from knowledgebaseSections where sectionSlug=?), ?, ?)`, [articleSlug, articleName, articleDescription, articleLink, articleSection, position, published], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: `The article called ${articleName} has been created.`
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
        isFeatureEnabled(features.knowledgebase, res, lang);
                
        const slug = required(req.body, "slug", res);
        const articleSlug = required(req.body, "articleSlug", res);
        const articleName = required(req.body, "articleName", res);
        const articleDescription = required(req.body, "articleDescription", res);
        const articleLink = required(req.body, "articleLink", res);
        const articleSection = required(req.body, "articleSection", res);
        const position = required(req.body, "position", res);
        const published = required(req.body, "published", res);

        try {
            db.query(`UPDATE knowledgebaseArticles SET articleSlug=?, articleName=?, articleDescription=?, articleLink=?, sectionId=?, position=?, published=? WHERE articleSlug=?`, [articleSlug, articleName, articleDescription, articleLink, articleSection, position, published, slug], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: `The article called ${slug} has been updated.`
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