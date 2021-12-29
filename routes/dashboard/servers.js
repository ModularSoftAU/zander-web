const express = require('express');
const router = express.Router();
const config = require('../../config.json');

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