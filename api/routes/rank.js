const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/rank";


router.get(baseEndpoint + '/get', (req, res, next) => {
    // ...
    res.json({ success: true });
});

router.get(baseEndpoint + '/user', (req, res, next) => {
    // Note: One or more of these could be null.
    const username = req.query.username;
    const rank = req.query.rank;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/create', (req, res, next) => {
    const rankSlug = req.body.rankSlug;
    const displayName = req.body.displayName;
    const priority = req.body.priority;
    const rankBadgeColour = req.body.rankBadgeColour;
    const rankTextColour = req.body.rankTextColour;
    const discordRoleId = req.body.discordRoleId;
    const isStaff = req.body.isStaff;
    const isDonator = req.body.isDonator;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/edit', (req, res, next) => {
    const rankSlug = req.body.rankSlug;
    const displayName = req.body.displayName;
    const priority = req.body.priority;
    const rankBadgeColour = req.body.rankBadgeColour;
    const rankTextColour = req.body.rankTextColour;
    const discordRoleId = req.body.discordRoleId;
    const isStaff = req.body.isStaff;
    const isDonator = req.body.isDonator;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const rankSlug = req.body.rankSlug;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/assign', (req, res, next) => {
    const rankSlug = req.body.rankSlug;
    const username = req.body.username;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/unassign', (req, res, next) => {
    const rankSlug = req.body.rankSlug;
    const username = req.body.username;

    // ...
    res.json({ success: true });
});

module.exports = router