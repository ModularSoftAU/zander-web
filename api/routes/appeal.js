const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/appeal";


router.post(baseEndpoint + '/create', (req, res, next) => {
    const punishmentId = req.body.punishmentId;

    // ...
    res.json({ success: true });
});

router.get(baseEndpoint + '/:punishmentId', (req, res, next) => {
    const punishmentId = req.params.punishmentId;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/comment', (req, res, next) => {
    const punishmentId = req.body.punishmentId;
    const staffId = req.body.staffId;
    const content = req.body.content;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/accept', (req, res, next) => {
    const punishmentId = req.body.punishmentId;
    const staffId = req.body.staffId;
    const content = req.body.content;
    const action = req.body.action;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/deny', (req, res, next) => {
    const punishmentId = req.body.punishmentId;
    const staffId = req.body.staffId;
    const content = req.body.content;
    const action = req.body.action;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/escalate', (req, res, next) => {
    const punishmentId = req.body.punishmentId;
    const staffId = req.body.staffId;
    const content = req.body.content;
    const action = req.body.action;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/deescalate', (req, res, next) => {
    const punishmentId = req.body.punishmentId;
    const staffId = req.body.staffId;
    const content = req.body.content;
    const action = req.body.action;

    // ...
    res.json({ success: true });
});

module.exports = router