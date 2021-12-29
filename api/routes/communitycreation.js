const express = require('express');
const router = express.Router();
const config = require('../../config.json');
const baseEndpoint = config.siteConfiguration.apiRoute + "/communitycreation";


router.get(baseEndpoint + '/get', (req, res, next) => {
    // ...
    res.json({ success: true });
});

router.post(baseEndpoint + '/submit', (req, res, next) => {
    const creator = req.body.creator;
    const creationName = req.body.creationName;
    const creationDescription = req.body.creationDescription;

    try {
        db.query(`INSERT INTO communityCreations (creatorId, creationName, creationDescription) VALUES ((select userId where username=?), ?, ?)`, [creator, creationName, creationDescription], function (error, results, fields) {
            if (error) {
                return res.json({ 
                    success: false,
                    message: `${error}`
                });
            }
            return res.json({ 
                success: true,
                message: `The creation ${creationName} has been successfully submitted for approval.`
            });
        });
        
    } catch (error) {
        res.json({ 
            success: false,
            message: `${error}`
        });   
    }
});

router.post(baseEndpoint + '/delete', (req, res, next) => {
    const creationId = req.body.creationId;

    // ...
    res.json({ success: true });
});

module.exports = router