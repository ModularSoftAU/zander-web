const express = require('express');
const router = express.Router();
const config = require('../../config.json');

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

module.exports = router;