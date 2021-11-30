const express = require('express');
const router = express.Router();
const config = require('../config.json');

router.get('/', (req, res, next) => {
    res.render('index', {
        "pageTitle": `Home`,
        config: config
    });
});

module.exports = router;
