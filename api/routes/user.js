const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/user";

router.post(baseEndpoint + '/create', (req, res, next) => {
    const uuid = req.body.uuid;
    const username = req.body.username;

    try {
        // shadowolf
        // Check if user does not exist, we do this in case of testing we create multiple users on accident
        db.query(`SELECT * FROM users WHERE uuid=?`, [uuid], function(error, results, fields) {
            if (results[0]) {
                return res.json({
                    success: false,
                    message: `This user already exists (somehow), terminating creation.`
                });
            }

            // If user does not exist, create them
            db.query(`INSERT INTO users (uuid, username) VALUES (?, ?)`, [uuid, username], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send(`${username} (${uuid}) has been successfully created.`);
            });
        });
    } catch (error) {
        return res.json({
            success: false,
            message: `${error}`
        });
    }
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

router.post(baseEndpoint + '/statistics', (req, res, next) => {
    // Username/uuid could be moved to the url fairly easily.
    const username = req.body.playerName;
    const uuid = req.body.playerUUID;
    const blocksTravelled = req.body.blocksTravelled;
    const damageDealt = req.body.damageDealt;
    const minedDiamondOre = req.body.minedDiamondOre;
    const minedDirt = req.body.minedDirt;
    const mobKills = req.body.mobKills;
    const totalWorldTimeSeconds = req.body.totalWorldTimeSeconds;

    console.log("username: " + username);
    console.log("uuid: " + uuid);
    console.log("blocksTravelled: " + blocksTravelled);
    console.log("damageDealt: " + damageDealt);
    console.log("minedDiamondOre: " + minedDiamondOre);
    console.log("minedDirt: " + minedDirt);
    console.log("mobKills: " + mobKills);
    console.log("totalWorldTimeSeconds: " + totalWorldTimeSeconds);

    // ...
    res.json({ success: true });
});

module.exports = router