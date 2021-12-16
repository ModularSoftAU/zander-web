const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/communitycreation";


router.get(baseEndpoint + '/get', (req, res, next) => {
    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/submit', (req, res, next) => {
    const creatorId = req.body.creatorId;
    const creationName = req.body.creationName;
    const creationDescription = req.body.creationDescription;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const creationId = req.body.creationId;

    // ...
    res.json({ success: true });
});

module.exports = router