const express = require('express');
const router = express.Router();
const config = require('../../config.json');

// 
// Knowledgebase
// 
router.get('/dashboard/knowledgebase', (req, res, next) => {
    res.render('dashboard/knowledgebase/list', {
        "pageTitle": `Dashboard - Knowledgebase`,
        config: config
    });
});

router.get('/dashboard/knowledgebase/create/section', (req, res, next) => {
    res.render('dashboard/knowledgebase/createSection', {
        "pageTitle": `Dashboard - Create Knowledgebase Section`,
        config: config
    });
});

router.get('/dashboard/knowledgebase/create/article', (req, res, next) => {
    res.render('dashboard/knowledgebase/createArticle', {
        "pageTitle": `Dashboard - Create Knowledgebase Article`,
        config: config
    });
});

module.exports = router;