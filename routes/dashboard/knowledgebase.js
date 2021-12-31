const config = require('../../config.json');

module.exports = (app) => {

    // 
    // Knowledgebase
    // 
    app.get('/dashboard/knowledgebase', (req, res, next) => {
        res.render('dashboard/knowledgebase/list', {
            "pageTitle": `Dashboard - Knowledgebase`,
            config: config
        });
    });

    app.get('/dashboard/knowledgebase/create/section', (req, res, next) => {
        res.render('dashboard/knowledgebase/createSection', {
            "pageTitle": `Dashboard - Create Knowledgebase Section`,
            config: config
        });
    });

    app.get('/dashboard/knowledgebase/create/article', (req, res, next) => {
        res.render('dashboard/knowledgebase/createArticle', {
            "pageTitle": `Dashboard - Create Knowledgebase Article`,
            config: config
        });
    });

}