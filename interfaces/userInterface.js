import db from '../controllers/databaseController';

export function linkUserDiscordID(discordID, req, reply) {    
    try {        
        db.query(`UPDATE users SET discordID=? WHERE username=?;`, [discordID, req.session.user.username], function (error, results, fields) {
            if (error) {
                return reply.send({
                    success: false,
                    message: error
                });
            }
            
            req.session.user.discordID = discordID;

            if (!results || !results.length) {
                return reply.send({
                    success: false,
                    message: `Something doesn't exist`
                });
            }

            reply.send({
                success: true,
                data: results
            });
        });
    } catch (error) {
        console.log(error);
        return reply.send({
            success: false,
            message: `${error}`
        });
    }
}

export function unlinkUserDiscordID(discordID, req, reply) {
    try {
        db.query(`UPDATE users SET discordID=? WHERE username=? AND discordID=?;`, [null, req.session.user.username, discordID], function (error, results, fields) {
            if (error) {
                return reply.send({
                    success: false,
                    message: error
                });
            }

            req.session.user.discordID = null;

            if (!results || !results.length) {
                return reply.send({
                    success: false,
                    message: `Something doesn't exist`
                });
            }

            reply.send({
                success: true,
                data: results
            });
        });
    } catch (error) {
        console.log(error);
        return reply.send({
            success: false,
            message: `${error}`
        });
    }
}