const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/friend";


router.post(baseEndpoint + '/request', (req, res, next) => {
    const requestee = req.body.requestee;
    const requestedUser = req.body.requestedUser;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/accept', (req, res, next) => {
    const requestee = req.body.requestee;
    const requestedUser = req.body.requestedUser;
    const action = req.body.action;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/deny', (req, res, next) => {
    const requestee = req.body.requestee;
    const requestedUser = req.body.requestedUser;
    const action = req.body.action;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/block', (req, res, next) => {
    const requestee = req.body.requestee;
    const requestedUser = req.body.requestedUser;
    const action = req.body.action;

    // ...
    res.json({ success: true });
});

module.exports = router