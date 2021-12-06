const express = require('express');
const router = express.Router();
const config = require('../config.json');

router.get('/dashboard', (req, res, next) => {
    res.render('dashboard/index', {
        "pageTitle": `Dashboard`,
        config: config
    });
});

module.exports = router;
