const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/vote";


router.post(baseEndpoint + '/cast', (req, res, next) => {
    const username = req.body.username;
    const dateTime = req.body.dateTime;
    const service = req.body.service;

    // ...
    res.json({ success: true });
});

router.get(baseEndpoint + '/get', (req, res, next) => {
    // ...
    res.json({ success: true });
});

module.exports = router