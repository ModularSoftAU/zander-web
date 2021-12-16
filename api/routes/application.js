const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/application";


router.get(baseEndpoint + '/get', (req, res, next) => {
    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/create', (req, res, next) => {
    const displayName = req.body.displayName;
    const description = req.body.description;
    const displayIcon = req.body.displayIcon;
    const requirementsMarkdown = req.body.requirementsMarkdown;
    const redirectURL = req.body.redirectURL;
    const position = req.body.position;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/edit', (req, res, next) => {
    const applicationId = req.body.applicationId;
    const displayName = req.body.displayName;
    const description = req.body.description;
    const displayIcon = req.body.displayIcon;
    const requirementsMarkdown = req.body.requirementsMarkdown;
    const redirectURL = req.body.redirectURL;
    const position = req.body.position;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const applicationId = req.body.applicationId;

    // ...
    res.json({ success: true });
});

module.exports = router