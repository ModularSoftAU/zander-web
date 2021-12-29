const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/event";


router.get(baseEndpoint + '/get', (req, res, next) => {
    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/create', (req, res, next) => {
    const name = req.body.name;
    const icon = req.body.icon;
    const eventDateTime = req.body.eventDateTime;
    const hostingServer = req.body.hostingServer;
    const information = req.body.information;

    try {
        db.query(`INSERT INTO events (name, icon, eventDateTime, hostingServer, information) VALUES (?, ?, ?, ?, ?)`, [name, icon, eventDateTime, hostingServer, information], function (error, results, fields) {
            if (error) {
                return res.json({ 
                    success: false,
                    message: `${error}`
                });
            }
            return res.json({ 
                success: true,
                message: `The event ${name} has been successfully created!`
            });
        });
        
    } catch (error) {
        res.json({ 
            success: false,
            message: `${error}`
        });   
    }
});

router.post(baseEndpoint + '/edit', (req, res, next) => {
    const eventId = req.body.eventId;
    const name = req.body.name;
    const icon = req.body.icon;
    const eventDateTime = req.body.eventDateTime;
    const hostingServer = req.body.hostingServer;
    const information = req.body.information;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const eventId = req.body.eventId;

    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/publish', (req, res, next) => {
    const eventId = req.body.eventId;

    // ...
    res.json({ success: true });
});

module.exports = router