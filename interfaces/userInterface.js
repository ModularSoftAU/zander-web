import db from '../controllers/databaseController';

export function linkUserDiscordID(discordID, request, reply) {    
    try {        
        db.query(`UPDATE users SET discordID=? WHERE username=?;`, [discordID, request.session.user.username], function (error, results, fields) {
            if (error) {
                return reply.send({
                    success: false,
                    message: error
                });
            }
            
            request.session.user.discordID = discordID;

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

export function unlinkUserDiscordID(discordID, request, reply) {
    try {
        db.query(`UPDATE users SET discordID=? WHERE username=? AND discordID=?;`, [null, request.session.user.username, discordID], function (error, results, fields) {
            if (error) {
                return reply.send({
                    success: false,
                    message: error
                });
            }

            request.session.user.discordID = null;

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