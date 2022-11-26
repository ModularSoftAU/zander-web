import db from '../controllers/databaseController';

export function linkUserDiscordID(discordID, req, res) {    
    try {        
        db.query(`UPDATE users SET discordID=? WHERE username=?;`, [discordID, req.session.user.username], function (error, results, fields) {
            if (error) {
                return res.send({
                    success: false,
                    message: error
                });
            }
            
            req.session.user.discordID = discordID;

            if (!results || !results.length) {
                return res.send({
                    success: false,
                    message: `Something doesn't exist`
                });
            }

            res.send({
                success: true,
                data: results
            });
        });
    } catch (error) {
        console.log(error);
        return res.send({
            success: false,
            message: `${error}`
        });
    }
}

export function unlinkUserDiscordID(discordID, req, res) {
    try {
        db.query(`UPDATE users SET discordID=? WHERE username=? AND discordID=?;`, [null, req.session.user.username, discordID], function (error, results, fields) {
            if (error) {
                return res.send({
                    success: false,
                    message: error
                });
            }

            req.session.user.discordID = null;

            if (!results || !results.length) {
                return res.send({
                    success: false,
                    message: `Something doesn't exist`
                });
            }

            res.send({
                success: true,
                data: results
            });
        });
    } catch (error) {
        console.log(error);
        return res.send({
            success: false,
            message: `${error}`
        });
    }
}