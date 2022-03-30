import {isFeatureEnabled, required, optional} from '../common'

export default function communityCreationApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/communitycreation';

    app.get(baseEndpoint + '/get', async function(req, res) {
        // Note: One or more of these could be null.
        const username = req.query.username;
        const creationId = req.query.id;
		const approvedOnly = req.query.approvedOnly;
		
		//Whether or not to /get unapproved creations
		var approved = '1';
		if(approvedOnly === false) {
			approved = '0,1';
		}
		
		// If the ?username= is used, get all creations by that user
		if(username) {
			try {
				db.query(`
					SELECT
						cc.*,
						imagesUnapproved.count AS totalImagesUnapproved,
						cci.imageLink AS coverImageLink,
						u.username
					FROM communityCreations cc
						JOIN users u ON cc.creatorId = u.userId
						LEFT JOIN communityCreationImages cci ON cc.creationId = cci.creationId
							AND cci.cover = 1
							AND cci.approved IN (?)
						LEFT JOIN (
							SELECT
								creationId,
								COUNT(*) AS count
							FROM communityCreationImages
							WHERE approved = 0
							GROUP BY creationId
						) imagesUnapproved ON cc.creationId = imagesUnapproved.creationId
					WHERE u.username = ?
						AND cc.approved IN (?)
				`, [approved, username, approved], function(error, results, fields) {
					if (error) {
						return res.send({
							success: false,
							message: `${error}`
						});
					}
					return res.send({
						success: true,
						data: results
					});
				});
			} catch (error) {
				res.send({
					success: false,
					message: `${error}`
				});
			}
		}
		
		// If the ?id= is used, get specific creation with all images
		if(creationId) {
			try {
				db.query(`
					SELECT
						cc.*,
						imagesUnapproved.count AS totalImagesUnapproved,
						cci.imageLink,
						cci.cover,
						cci.position,
						cci.approved AS imageApproved,
						u.username
					FROM communityCreations cc
						JOIN users u ON cc.creatorId = u.userId
						LEFT JOIN communityCreationImages cci ON cc.creationId = cci.creationId
							AND cci.approved IN (?)
						LEFT JOIN (
							SELECT
								creationId,
								COUNT(*) AS count
							FROM communityCreationImages
							WHERE approved = 0
							GROUP BY creationId
						) imagesUnapproved ON cc.creationId = imagesUnapproved.creationId
					WHERE cc.creationId = ?
						AND cc.approved IN (?)
					ORDER BY cci.position ASC
				`, [approved, creationId, approved], function(error, results, fields) {
					if (error) {
						return res.send({
							success: false,
							message: `${error}`
						});
					}
					return res.send({
						success: true,
						data: results
					});
				});
			} catch (error) {
				res.send({
					success: false,
					message: `${error}`
				});
			}
		}
		
		//No username or id parameter, pull full list
        try {
            db.query(`
				SELECT
					cc.*,
					imagesUnapproved.count AS totalImagesUnapproved,
					cci.imageLink AS coverImageLink,
					u.username
				FROM communityCreations cc
					JOIN users u ON cc.creatorId = u.userId
					LEFT JOIN communityCreationImages cci ON cc.creationId = cci.creationId
						AND cci.cover = 1
						AND cci.approved IN (?)
					LEFT JOIN (
						SELECT
							creationId,
							COUNT(*) AS count
						FROM communityCreationImages
						WHERE approved = 0
						GROUP BY creationId
					) imagesUnapproved ON cc.creationId = imagesUnapproved.creationId
				WHERE cc.approved IN (?)
			`, [approved, approved], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/submit', async function(req, res) {
        const creator = required(req.body, "creator", res);
        const creationName = optional(req.body, "creationName");
        const creationDescription = optional(req.body, "creationDescription");
        const creationLink = required(req.body, "creationLink", res);

        try {
            db.query(`INSERT INTO communityCreations (creatorId, creationName, creationDescription) VALUES ((select userId from users where username=?), ?, ?)`, [creator, creationName, creationDescription], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.send({
                    success: true,
                    message: `The creation ${creationName} has been successfully submitted for approval.`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/approve', async function(req, res) {
        const id = required(req.body, "id", res);
         
        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/deny', async function(req, res) {
        const id = required(req.body, "id", res);
         
        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const creationId = required(req.body, "creationId", res);

        // ...
        res.send({ success: true });
    });

}