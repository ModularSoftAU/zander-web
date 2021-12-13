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
    res.render('play', {
        "pageTitle": `Play`,
        config: config
    });
});

module.exports = router;
