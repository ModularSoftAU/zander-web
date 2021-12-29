const express = require('express');
const router = express.Router();
const config = require('../config.json');
const path = require('path');
const fs = require('fs');

router.get('/', (req, res, next) => {
    res.render('modules/index/index', {
        "pageTitle": `${config.siteConfiguration.siteName}`,
        config: config
    });
});

// 
// Play
// 
router.get('/play', (req, res, next) => {
    res.render('modules/play/play', {
        "pageTitle": `Play`,
        config: config
    });
});

// 
// Community Creations
// 
router.get('/communityCreations', (req, res, next) => {
    res.render('modules/communityCreation/communityCreation', {
        "pageTitle": `Community Creations`,
        config: config
    });
});

router.get('/communityCreation/submit', (req, res, next) => {
    res.render('modules/communityCreation/submit', {
        "pageTitle": `Submit a Community Creation`,
        config: config
    });
});

// 
// Apply
// 
router.get('/apply', (req, res, next) => {
    res.render('apply', {
        "pageTitle": `Apply`,
        config: config
    });
});

// 
// Events
// 
router.get('/events', (req, res, next) => {
    res.render('events', {
        "pageTitle": `Events`,
        config: config
    });
});

// 
// Vote
// 
router.get('/vote', (req, res, next) => {
    res.render('vote', {
        "pageTitle": `Vote`,
        config: config
    });
});

// 
// Staff
// 
router.get('/staff', (req, res, next) => {
    res.render('staff', {
        "pageTitle": `Staff`,
        config: config
    });
});

// 
// Profile
// 
router.get('/profile', (req, res, next) => {
    res.render('profile', {
        "pageTitle": `USERNAME's Profile`,
        config: config
    });
});

// 
// Punishments
// 
router.get('/punishments', (req, res, next) => {
    res.render('punishments', {
        "pageTitle": `Punishments`,
        config: config
    });
});

// 
// Session
// 
router.get('/login', (req, res, next) => {
    res.render('login', {
        "pageTitle": `Login`,
        config: config
    });
});

router.get('/register', (req, res, next) => {
    res.render('register', {
        "pageTitle": `Register`,
        config: config
    });
});

// 
// Appeal
// 
router.get('/appeal', (req, res, next) => {
    res.render('appeal', {
        "pageTitle": `Appeal`,
        config: config
    });
});

// 
// Shopping District Directory
// 
router.get('/shoppingDistrictDirectory', (req, res, next) => {
    res.render('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
        "pageTitle": `Shopping District Directory`,
        config: config
    });
});

router.get('/sdd', (req, res, next) => {
    res.render('modules/shoppingDistrictDirectory/shoppingDistrictDirectory', {
        "pageTitle": `Shopping District Directory`,
        config: config
    });
});

router.get('/shoppingDistrictDirectory/create', (req, res, next) => {
    fs.readdir(path.join(__dirname, '../assets/images/minecraftItemImages'), function(err, files) {
        //handling error
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }
        //listing all files using forEach
        files.forEach(function(file) {
            // Do whatever you want to do with the file
            // console.log(file);
        });

        res.render('modules/shoppingDistrictDirectory/create', {
            "pageTitle": `Shopping District Directory`,
            config: config,
            minecraftItem: files
        });
    });
});

module.exports = router;
