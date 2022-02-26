export default function rankApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/rank';

    app.get(baseEndpoint + '/get', async function(req, res) {
		// Note: One or more of these could be null.
        const username = req.query.username;
        const rank = req.query.rank;
		
		// If the ?username= is used, get all ranks for that user
		if(username) {
			try {
				db.query(`
					SELECT
						r.*,
						ur.title
					FROM ranks r
						JOIN userRanks ur ON ur.rankSlug = r.rankSlug
						JOIN luckpermsPlayers lpPlayers ON ur.uuid = lpPlayers.uuid
					WHERE lpPlayers.username = ?
				`, [username], function(error, results, fields) {
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
		
		// If the ?rank= is used, get all users with that rank
		if(rank) {
			try {
				db.query(`
					SELECT
						u.userId,
						lpPlayers.uuid,
						COALESCE(u.username, lpPlayers.username) AS username,
						r.rankSlug,
						r.displayName,
						r.rankBadgeColour,
						r.rankTextColour,
						ur.title
					FROM ranks r
						JOIN userRanks ur ON ur.rankSlug = r.rankSlug
						JOIN luckpermsPlayers lpPlayers ON ur.uuid = lpPlayers.uuid
						LEFT JOIN users u ON lpPlayers.uuid = u.uuid
					WHERE r.rankSlug = ?
				`, [rank], function(error, results, fields) {
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
		
        try {
            db.query(`SELECT * FROM ranks`, function(error, results, fields) {
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

}