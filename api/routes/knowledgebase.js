const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/knowledgebase";

module.exports = (app) => {

    // Jaedan: Some get routes should be added for the knowledgebase
    // Data goes in but none comes out currently
    app.get(baseEndpoint + '/section/get', (req, res, next) => {
        try {
            db.query(`SELECT * FROM knowledgebaseSections ORDER BY position ASC;`, function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/section/create', (req, res, next) => {
        const sectionSlug = req.body.sectionSlug;
        const sectionName = req.body.sectionName;
        const description = req.body.description;
        const sectionIcon = req.body.sectionIcon;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO knowledgebaseSections (sectionSlug, sectionName, description, sectionIcon, position) VALUES (?, ?, ?, ?, ?)`, [sectionSlug, sectionName, description, sectionIcon, position], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The knowledgebase section ${sectionName} has been successfully created!`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/section/update', (req, res, next) => {
        const sectionSlug = req.body.sectionSlug;
        const sectionName = req.body.sectionName;
        const description = req.body.description;
        const sectionIcon = req.body.sectionIcon;
        const position = req.body.position;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/section/delete', (req, res, next) => {
        const sectionSlug = req.body.sectionSlug;

        try {
            db.query(`DELETE FROM knowledgebaseSections WHERE sectionSlug = ?;`, [sectionSlug], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `Deletion of knowledgebase section with the slug of ${sectionSlug} has been successful`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.get(baseEndpoint + '/article/get', (req, res, next) => {
        try {
            db.query(`SELECT * FROM knowledgebaseArticles ORDER BY position ASC;`, function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/article/create', (req, res, next) => {
        const articleSlug = req.body.articleSlug;
        const articleName = req.body.articleName;
        const articleLink = req.body.articleLink;
        const articleSection = req.body.articleSection;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO knowledgebaseArticles (articleSlug, articleName, articleLink, sectionId, position) VALUES (?, ?, ?, (select sectionId from knowledgebaseSections where sectionSlug=?), ?)`, [articleSlug, articleName, articleLink, articleSection, position], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The knowledgebase article ${articleName} has been successfully created!`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/article/update', (req, res, next) => {
        const articleSlug = req.body.articleSlug;
        const articleName = req.body.articleName;
        const articleLink = req.body.articleLink;
        const section = req.body.section;
        const position = req.body.position;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/article/delete', (req, res, next) => {
        const articleSlug = req.body.articleSlug;

        try {
            db.query(`DELETE FROM knowledgebaseArticles WHERE articleSlug = ?;`, [articleSlug], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `Deletion of knowledgebase article with the slug of ${articleSlug} has been successful`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

}
