import {isFeatureEnabled, required, optional} from '../common'

export default function communityCreationApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/communitycreation';

    app.get(baseEndpoint + '/get', async function(req, res) {
        // Note: One or more of these could be null.
        const username = req.query.username;
        const creationId = req.query.id;
		const approvedOnly = req.query.approvedOnly;
		
		// set the number of items to display per page
		const limit = parseInt((req.query.limit) ? req.query.limit : 6);
		const page = (req.query.page) ? req.query.page : 1;
		const offset = (page - 1) * limit;

		// Whether or not to /get unapproved creations
		var approved = '1';
		if (approvedOnly === false) {
			approved = '0,1';
		}

		// If the ?username= is used, get all creations by that user
		if (username) {
			try {
				db.query(`
					SELECT
						cc.*,
						u.username,
						COALESCE(likes.count, 0) AS likes,
						CONCAT('["', cci.imageLinks, '"]') AS imageLinks
					FROM communityCreations cc
						JOIN users u ON cc.creatorId = u.userId
						LEFT JOIN (
							SELECT
								creationId,
								GROUP_CONCAT(imageLink ORDER BY position ASC SEPARATOR '","') AS imageLinks
							FROM communityCreationImages
							GROUP BY creationId
						) cci ON cc.creationId = cci.creationId
						LEFT JOIN (
							SELECT
								creationId,
								COUNT(*) AS count
							FROM communityLikes
							GROUP BY creationId
						) likes ON cc.creationId = likes.creationId
					WHERE u.username = ?
						AND cc.approved IN (?)
					ORDER BY cc.submittedDate DESC
					LIMIT ?, ?
				`, [username, approved, offset, limit], function(error, results, fields) {
					if (error) {
						return res.send({
							success: false,
							message: `${error}`
						});
					}
                    
					return res.send({
						success: true,
						data: results.map(row => (row.imageLinks = JSON.parse(row.imageLinks.replace('\"', '"')), row)),
						page: page,
						limit: limit
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
		if (creationId) {
			try {
				db.query(`
					SELECT
						cc.*,
						u.username,
						COALESCE(likes.count, 0) AS likes,
						CONCAT('["', cci.imageLinks, '"]') JSON AS imageLinks
					FROM communityCreations cc
						JOIN users u ON cc.creatorId = u.userId
						LEFT JOIN (
							SELECT
								creationId,
								GROUP_CONCAT(imageLink ORDER BY position ASC SEPARATOR '","') AS imageLinks
							FROM communityCreationImages
							GROUP BY creationId
						) cci ON cc.creationId = cci.creationId
						LEFT JOIN (
							SELECT
								creationId,
								COUNT(*) AS count
							FROM communityLikes
							GROUP BY creationId
						) likes ON cc.creationId = likes.creationId
					WHERE cc.creationId = ?
						AND cc.approved IN (?)
					ORDER BY cc.submittedDate DESC
					LIMIT ?, ?
				`, [creationId, approved, offset, limit], function(error, results, fields) {
					if (error) {
						return res.send({
							success: false,
							message: `${error}`
						});
					}

					return res.send({
						success: true,
						data: results.map(row => (row.imageLinks = JSON.parse(row.imageLinks.replace('\"', '"')), row)),
						page: page,
						limit: limit
					});
				});
			} catch (error) {
				res.send({
					success: false,
					message: `${error}`
				});
			}
		}

		// No username or id parameter, pull full list
        try {
            db.query(`
				SELECT
					cc.*,
					u.username,
					COALESCE(likes.count, 0) AS likes,
					CONCAT('["', cci.imageLinks, '"]') AS imageLinks
				FROM communityCreations cc
					JOIN users u ON cc.creatorId = u.userId
					LEFT JOIN (
						SELECT
							creationId,
							GROUP_CONCAT(imageLink ORDER BY position ASC SEPARATOR '","') AS imageLinks
						FROM communityCreationImages
						GROUP BY creationId
					) cci ON cc.creationId = cci.creationId
					LEFT JOIN (
						SELECT
							creationId,
							COUNT(*) AS count
						FROM communityLikes
						GROUP BY creationId
					) likes ON cc.creationId = likes.creationId
				WHERE cc.approved IN (?)
				ORDER BY cc.submittedDate DESC
				LIMIT ?, ?
			`, [approved, offset, limit], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    data: results.map(row => (row.imageLinks = JSON.parse(row.imageLinks.replace('\"', '"')), row)),
					page: page,
					limit: limit
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
        const creatorId = required(req.body, "creatorId", res);
        const creationName = optional(req.body, "creationName");
        const creationDescription = optional(req.body, "creationDescription");
        const creationImage = required(req.body, "creationImage", res);

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

                console.log(creationImageFiltered);
                console.log(creationInsertResults.insertId);

                creationImageFiltered.forEach(image => {
                    db.query(`INSERT INTO communityCreationImages (creationId, imageLink) VALUES (?, ?)`, [creationInsertResults.insertId, image], function(error, results, fields) {
                        if (error) {
                            return res.send({
                                success: false,
                                message: `${error}`
                            });
                        }
                    });                    
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

        try {
            db.query(`UPDATE communitycreations SET approved = ? WHERE creationId;`, [1], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
					success: true,
					message: lang.communityCreation.creationApproval
				});
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const creationId = required(req.body, "creationId", res);

        try {
            db.query(`DELETE FROM communityCreations WHERE creationId=?; DELETE FROM communityCreationImages WHERE creationId=?;`, [creationId, creationId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
					success: true,
					message: lang.communityCreation.creationDenied
				});
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/like', async function(req, res) {
        const userId = req.body.userId;
        const creationId = req.body.creationId;

        try {
            db.query(`INSERT INTO communityLikes (creationId, userId) VALUES (?, ?);`, [creationId, userId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
					success: true,
					message: lang.communityCreation.creationLike
				});
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/unlike', async function(req, res) {
        const userId = req.body.userId;
        const creationId = req.body.creationId;

        try {
            db.query(`DELETE FROM communityLikes WHERE creationId = ? AND userId = ?;`, [creationId, userId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
					success: true,
					message: lang.communityCreation.creationUnlike
				});
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

}