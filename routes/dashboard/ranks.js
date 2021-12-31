const express = require('express');
const router = express.Router();
const config = require('../../config.json');

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

module.exports = router;