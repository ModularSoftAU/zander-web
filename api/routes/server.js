const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/server";


router.get(baseEndpoint + '/get', (req, res, next) => {
    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/create', (req, res, next) => {
    const name = req.body.name;
    const ipAddress = req.body.ipAddress;
    const port = req.body.port;
    const visability = req.body.visability;
    const position = req.body.position;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/edit', (req, res, next) => {
    const serverId = req.body.serverId;
    const name = req.body.name;
    const ipAddress = req.body.ipAddress;
    const port = req.body.port;
    const visability = req.body.visability;
    const position = req.body.position;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const reportedUser = req.body.serverId;

    // ...
    res.json({ success: true });
});

module.exports = router