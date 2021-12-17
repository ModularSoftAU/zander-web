const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/knowledgebase";


// Jaedan: Some get routes should be added for the knowledgebase
// Data goes in but none comes out currently


router.post(baseEndpoint + '/section/create', (req, res, next) => {
    const sectionSlug = req.body.sectionSlug;
    const sectionName = req.body.sectionName;
    const description = req.body.description;
    const sectionIcon = req.body.sectionIcon;
    const position = req.body.position;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/section/update', (req, res, next) => {
    const sectionSlug = req.body.sectionSlug;
    const sectionName = req.body.sectionName;
    const description = req.body.description;
    const sectionIcon = req.body.sectionIcon;
    const position = req.body.position;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/section/delete', (req, res, next) => {
    const sectionSlug = req.body.sectionSlug;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/article/create', (req, res, next) => {
    const articleSlug = req.body.articleSlug;
    const articleName = req.body.articleName;
    const articleLink = req.body.articleLink;
    const section = req.body.section;
    const position = req.body.position;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/article/update', (req, res, next) => {
    const articleSlug = req.body.articleSlug;
    const articleName = req.body.articleName;
    const articleLink = req.body.articleLink;
    const section = req.body.section;
    const position = req.body.position;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/article/delete', (req, res, next) => {
    const articleSlug = req.body.articleSlug;

    // ...
    res.json({ success: true });
});

module.exports = router