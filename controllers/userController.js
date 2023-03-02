import db from './databaseController';

/*
    Update the Discord ID of a user in the database
    that links the discordID field for the user with the matching username.

    @param discordID The Discord ID of the user.
    @param req Passing through req.
    @param res Passing through res.
*/
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

/*
    Update the Discord ID of a user in the database
    that unlinks the discordID field for the user with the matching username.

    @param discordID The Discord ID of the user.
    @param req Passing through req.
    @param res Passing through res.
*/
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