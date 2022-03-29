import {isFeatureEnabled, required, optional} from '../common'

export default function communityCreationApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/communitycreation';

    app.get(baseEndpoint + '/get', async function(req, res) {
        // Note: One or more of these could be null.
        const username = req.query.username;
        const creationId = req.query.id;
		const approvedOnly = req.query.approvedOnly;

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
                    
                    if (!results.length) {
                        return res.send({
                            success: false,
                            message: `There are no results`
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
		if (creationId) {
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

                    if (!results.length) {
                        return res.send({
                            success: false,
                            message: `There are no results`
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

		// No username or id parameter, pull full list
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

                if (!results.length) {
                    return res.send({
                        success: false,
                        message: `There are no results`
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
					message: `Creation has been approved and broadcasted.`
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
					message: `Creation has been denied and deleted.`
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
					message: `Creation a new like.`
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
					message: `Creation has been unliked.`
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