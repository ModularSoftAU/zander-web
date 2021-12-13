const express = require('express');
const router = express.Router();
const config = require('../config.json');

// 
// Knowledgebase
// 
router.get('/knowledgebase', (req, res, next) => {
    res.render('knowledgebase', {
        "pageTitle": `Knowledgebase`,
        config: config
    });
});

router.get('/support', (req, res, next) => {
    res.render('knowledgebase', {
        "pageTitle": `Knowledgebase`,
        config: config
    });
});

router.get('/help', (req, res, next) => {
    res.render('knowledgebase', {
        "pageTitle": `Knowledgebase`,
        config: config
    });
});

// 
// Knowledgebase Article
// 
router.get('/generalStaff/newStaff', (req, res, next) => {
    res.render('knowledgebaseArticle', {
        "pageTitle": `Knowledgebase - KB Article Title`,
        config: config
    });
});

module.exports = router;
