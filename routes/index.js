const express = require('express');
const router = express.Router();
const config = require('../config.json');

router.get('/', (req, res, next) => {
    res.render('index', {
        "pageTitle": `${config.siteConfiguration.siteName}`,
        config: config
    });
});

// 
// Play
// 
router.get('/play', (req, res, next) => {
    res.render('modules/play/play', {
        "pageTitle": `Play`,
        config: config
    });
});

// 
// Community Creations
// 
router.get('/communityCreations', (req, res, next) => {
    res.render('modules/communityCreation/communityCreation', {
        "pageTitle": `Community Creations`,
        config: config
    });
});

router.get('/communityCreation/submit', (req, res, next) => {
    res.render('modules/communityCreation/submit', {
        "pageTitle": `Submit a Community Creation`,
        config: config
    });
});

// 
// Apply
// 
router.get('/apply', (req, res, next) => {
    res.render('apply', {
        "pageTitle": `Apply`,
        config: config
    });
});

module.exports = router;
