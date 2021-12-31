const config = require('../config.json');

module.exports = (app) => {

    // 
    // Knowledgebase
    // 
    app.get('/knowledgebase', (req, res, next) => {
        res.render('modules/knowledgebase/knowledgebase', {
            "pageTitle": `Knowledgebase`,
            config: config
        });
    });

    app.get('/support', (req, res, next) => {
        res.render('modules/knowledgebase/knowledgebase', {
            "pageTitle": `Knowledgebase`,
            config: config
        });
    });

    app.get('/help', (req, res, next) => {
        res.render('modules/knowledgebase/knowledgebase', {
            "pageTitle": `Knowledgebase`,
            config: config
        });
    });

    // 
    // Knowledgebase Article
    // 
    app.get('/generalStaff/newStaff', (req, res, next) => {
        res.render('modules/knowledgebase/knowledgebaseArticle', {
            "pageTitle": `Knowledgebase - KB Article Title`,
            config: config
        });
    });

}