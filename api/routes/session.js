const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/session";


router.post(baseEndpoint + '/create', (req, res, next) => {
    const uuid = req.body.uuid;
    const ipAddress = req.body.ipAddress;
    const server = req.body.server;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/destroy', (req, res, next) => {
    const uuid = req.body.uuid;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/swtich', (req, res, next) => {
    const uuid = req.body.uuid;
    const server = req.body.server;

    // ...
    res.json({ success: true });
});

module.exports = router