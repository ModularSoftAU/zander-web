const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/punishment";


router.post(baseEndpoint + '/issue', (req, res, next) => {
    const playerUsername = req.body.playerUsername;
    const staffUsername = req.body.staffUsername;
    const platform = req.body.platform;
    const type = req.body.type;
    const length = req.body.length;
    const reason = req.body.reason;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const punishmentId = req.body.punishmentId;

    // ...
    res.json({ success: true });
});

router.get(baseEndpoint + '/user', (req, res, next) => {
    const username = req.query.username;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/latest', (req, res, next) => {
    const latest = req.body.latest;

    // ...
    res.json({ success: true });
});

module.exports = router