const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/server";

module.exports = (app) => {

    app.get(baseEndpoint + '/get', (req, res, next) => {
        try {
            db.query(`SELECT * FROM servers ORDER BY position ASC;`, function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', (req, res, next) => {
        const name = req.body.name;
        const ipAddress = req.body.ipAddress;
        const port = req.body.port;
        const visible = req.body.visible;
        const position = req.body.position;

        try {
            db.query(`INSERT INTO servers (name, ipAddress, port, visible, position) VALUES (?, ?, ?, ?, ?)`, [name, ipAddress, port, visible, position], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The server ${name} has been successfully created!`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/edit', (req, res, next) => {
        const serverId = req.body.serverId;
        const name = req.body.name;
        const ipAddress = req.body.ipAddress;
        const port = req.body.port;
        const visability = req.body.visability;
        const position = req.body.position;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/delete', (req, res, next) => {
        const serverId = req.body.serverId;

        try {
            db.query(`DELETE FROM servers WHERE serverId = ?;`, [serverId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `Deletion of server with the id ${serverId} has been successful`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

}
