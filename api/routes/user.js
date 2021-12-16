const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/user";


router.post(baseEndpoint + '/create', (req, res, next) => {
    const uuid = req.body.uuid;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/edit', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/about/update', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/authenticate/twitter', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/authenticate/twitch', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/authenticate/youtube', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/authenticate/instagram', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/authenticate/steam', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/authenticate/github', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/authenticate/spotify', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/profile/:username/authenticate/discord', (req, res, next) => {
    const username = req.params.username;
    // TODO

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/setting/:settingOption', (req, res, next) => {
    const settingOption = req.params.settingOption;
    // TODO

    // ...
    res.json({ success: true });
});

module.exports = router