const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/anticheat";


router.post(baseEndpoint + '/flag', (req, res, next) => {
    const username = req.body.username;
    const anticheatDateTime = req.body.anticheatDateTime;
    const type = req.body.type;

    // ...
    res.json({ success: true });
});

module.exports = router