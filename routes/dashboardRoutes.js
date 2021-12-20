const express = require('express');
const router = express.Router();
const config = require('../config.json');

router.get('/dashboard', (req, res, next) => {
    res.render('dashboard/index', {
        "pageTitle": `Dashboard`,
        config: config
    });
});

// 
// Player Check
// 
router.get('/dashboard/usercheck', (req, res, next) => {
    res.render('dashboard/usercheck', {
        "pageTitle": `Dashboard - User Check`,
        config: config
    });
});

// 
// Events
// 
router.get('/dashboard/events', (req, res, next) => {
    res.render('dashboard/events/list', {
        "pageTitle": `Dashboard - Events`,
        config: config
    });
});

router.get('/dashboard/events/schedule', (req, res, next) => {
    res.render('dashboard/events/schedule', {
        "pageTitle": `Dashboard - Event Planner`,
        config: config
    });
});

// 
// Ranks
// 
router.get('/dashboard/ranks', (req, res, next) => {
    res.render('dashboard/ranks/list', {
        "pageTitle": `Dashboard - Ranks`,
        config: config
    });
});

router.get('/dashboard/ranks/create', (req, res, next) => {
    res.render('dashboard/ranks/create', {
        "pageTitle": `Dashboard - Rank Creator`,
        config: config
    });
});

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

// 
// Servers
// 
router.get('/dashboard/servers', (req, res, next) => {
    res.render('dashboard/servers/list', {
        "pageTitle": `Dashboard - Servers`,
        config: config
    });
});

router.get('/dashboard/servers/create', (req, res, next) => {
    res.render('dashboard/servers/create', {
        "pageTitle": `Dashboard - Server Creator`,
        config: config
    });
});

module.exports = router;
