export default function communityCreationApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/communitycreation';

    app.get(baseEndpoint + '/get', async function(req, res) {
        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/submit', async function(req, res) {
        const creatorId = req.body.creatorId;
        const creationName = req.body.creationName;
        const creationDescription = req.body.creationDescription;
        const creationImage = req.body.creationImage;

        try {
            db.query(`INSERT INTO communityCreations (creatorId, creationName, creationDescription) VALUES (?, ?, ?)`, [creatorId, creationName, creationDescription], function(error, creationInsertResults, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                // Filter out empty image entries.
                const creationImageFiltered = creationImage.filter(element => {
                    return element !== '';
                });

                // Loop through all filtered images and insert them into the communityCreationImages table
                creationImageFiltered.forEach(function (image) {
                    db.query(`INSERT INTO communityCreationImages (creationId, imageLink) VALUES (?, ?)`, [creationInsertResults.insertId, image], function(error, results, fields) {
                        if (error) {
                            return res.send({
                                success: false,
                                message: `${error}`
                            });
                        }
                    });
                })
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const creationId = req.body.creationId;

        // ...
        res.send({ success: true });
    });

}