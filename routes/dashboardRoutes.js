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
