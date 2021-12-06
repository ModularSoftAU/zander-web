const express = require('express');
const router = express.Router();
const config = require('../config.json');

router.get('/terms', (req, res, next) => {
    res.render('policy/termsOfService', {
        "pageTitle": `Network Terms Of Service Policy`,
        config: config
    });
});

router.get('/rules', (req, res, next) => {
    res.render('policy/rules', {
        "pageTitle": `Network Rules`,
        config: config
    });
});

router.get('/privacy', (req, res, next) => {
    res.render('policy/privacy', {
        "pageTitle": `Network Privacy Policy`,
        config: config
    });
});

router.get('/refund', (req, res, next) => {
    res.render('policy/refund', {
        "pageTitle": `Network Refund Policy`,
        config: config
    });
});

module.exports = router;
