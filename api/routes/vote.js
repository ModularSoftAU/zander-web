import {isFeatureEnabled, required, optional} from '../common'

export default function voteApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/vote';

    app.post(baseEndpoint + '/cast', async function(req, res) {
        isFeatureEnabled(features.vote, res, lang);
        const username = required(req.body, "username", res);
        const voteSite = required(req.body, "voteSite", res);

        const newVoteCastLang = lang.vote.newVoteCast

        try {
            // Insert newly started session into database
            db.query(`
                INSERT INTO votes 
                    (
                        userId, 
                        voteSite
                    ) VALUES (
                        (SELECT userId FROM users WHERE username=?),
                        ?
                    )`, [username, voteSite], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: newVoteCastLang.replace("%USERNAME%", username)
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.vote, res, lang);

        try {
            db.query(`
                SELECT 
                    (SELECT username FROM users WHERE votes.userId=users.userId) AS 'username', count(*) AS votes 
                FROM votes 
                GROUP BY username 
                ORDER BY votes DESC;
            `, function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results.length) {
                    return res.send({
                        success: false,
                        message: lang.vote.noVotes
                    });
                }

                res.send({
                    success: true,
                    data: results
                });
            });
            
        } catch (error) {
            res.send({
                success: false,
                data: error
            });
        }
    });

}