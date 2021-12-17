const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/web";


router.post(baseEndpoint + '/login', (req, res, next) => {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/register/create', (req, res, next) => {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/register/verify', (req, res, next) => {
    const username = req.body.username;
    const verificationToken = req.body.verificationToken;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/forgot', (req, res, next) => {
    const username = req.body.username;
    // TODO

    // ...
    res.json({ success: true });
});

module.exports = router