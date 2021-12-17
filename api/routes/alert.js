const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/alert";


// Jaedan: A verifyUser function may need to be included for some of these routes


router.post(baseEndpoint + '/create', (req, res, next) => {
    // Some of these may not be const but have been assumed to be so thus far.
    const alertSlug = req.body.alertSlug;
    const body = req.body.body;
    const motd = req.body.motd;
    const tips = req.body.tips;
    const web = req.body.web;
    const link = req.body.link;
    const motdFormat = req.body.motdFormat;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/edit', (req, res, next) => {
    const alertSlug = req.body.alertSlug;
    const body = req.body.body;
    const motd = req.body.motd;
    const tips = req.body.tips;
    const web = req.body.web;
    const link = req.body.link;
    const motdFormat = req.body.motdFormat;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const alertSlug = req.body.alertSlug;

    // ...
    res.json({ success: true });
});

module.exports = router