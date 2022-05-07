import {isFeatureEnabled, required, optional} from '../common'

export default function sessionApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/session';

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);
        const ipAddress = required(req.body, "ipAddress", res);
        const server = required(req.body, "server", res);

        try {
            // Insert newly started session into database
            db.query(`
                INSERT INTO gameSessions 
                    (
                        userId, 
                        ipAddress, 
                        serverId
                    ) VALUES (
                        (SELECT userId FROM users WHERE uuid=?), 
                        ?,
                        (SELECT serverId FROM servers WHERE name=?)
                    )`, [uuid, ipAddress, server], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return res.send({
                    success: true,
                    message: `New session for ${uuid} has been created.`
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }

    });

    app.post(baseEndpoint + '/destroy', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);

        // try {
        //     // Insert newly started session into database
        //     db.query(`
        //         UPDATE gameSessions 
        //             (
        //                 userId, 
        //                 ipAddress, 
        //                 serverId
        //             ) VALUES (
        //                 (SELECT userId FROM users WHERE uuid=?), 
        //                 ?,
        //                 (SELECT serverId FROM servers WHERE name=?)
        //             )`, [uuid, ipAddress, server], function(error, results, fields) {
        //         if (error) {
        //             return res.send({
        //                 success: false,
        //                 message: `${error}`
        //             });
        //         }

        //         return res.send({
        //             success: true,
        //             message: `New session for ${uuid} has been created.`
        //         });
        //     });

        // } catch (error) {
        //     res.send({
        //         success: false,
        //         message: `${error}`
        //     });
        // }

    });

    app.post(baseEndpoint + '/switch', async function(req, res) {
        isFeatureEnabled(features.sessions, res, lang);
        const uuid = required(req.body, "uuid", res);
        const server = required(req.body, "server", res);

        // ...
        res.send({ success: true });
    });

}