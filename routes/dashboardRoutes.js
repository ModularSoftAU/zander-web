const express = require('express');
const router = express.Router();
const config = require('../config.json');

router.get('/dashboard', (req, res, next) => {
    res.render('dashboard/index', {
        "pageTitle": `Dashboard`,
        config: config
    });
});

router.get('/dashboard/playercheck', (req, res, next) => {
    res.render('dashboard/playerCheck', {
        "pageTitle": `Dashboard - Player Check`,
        config: config
    });
});

module.exports = router;
