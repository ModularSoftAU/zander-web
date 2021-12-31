const express = require('express');
const router = express.Router();
const config = require('../../config.json');

// 
// Dashboard
// 
router.get('/dashboard', (req, res, next) => {
    res.render('dashboard/indexViewNetwork', {
        "pageTitle": `Dashboard`,
        config: config
    });
});

router.get('/dashboard/view/network', (req, res, next) => {
    res.render('dashboard/indexViewNetwork', {
        "pageTitle": `Dashboard`,
        config: config
    });
});

router.get('/dashboard/view/punishment', (req, res, next) => {
    res.render('dashboard/indexViewPunishment', {
        "pageTitle": `Dashboard`,
        config: config
    });
});

// 
// Misc
// 

// 
// Player Check
// 
router.get('/dashboard/usercheck', (req, res, next) => {
    res.render('dashboard/usercheck', {
        "pageTitle": `Dashboard - User Check`,
        config: config
    });
});

module.exports = router;