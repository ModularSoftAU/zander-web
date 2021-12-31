const config = require('../../config.json');
const db = require('../../controllers/databaseController');
const baseEndpoint = config.siteConfiguration.apiRoute + "/event";
const { MessageEmbed } = require('discord.js');

module.exports = (app, DiscordClient, moment) => {

    app.get(baseEndpoint + '/get', (req, res, next) => {
        try {
            db.query(`SELECT * FROM events WHERE published=? ORDER BY eventDateTime ASC;`, [1], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results.length) {
                    return res.json({
                        success: true,
                        message: `There are currently no community events scheduled.`
                    });
                }

                res.json({
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
        const icon = req.body.icon;
        const eventDateTime = req.body.eventDateTime;
        const hostingServer = req.body.hostingServer;
        const information = req.body.information;

        try {
            db.query(`INSERT INTO events (name, icon, eventDateTime, hostingServer, information) VALUES (?, ?, ?, (select serverId from servers where name=?), ?)`, [name, icon, eventDateTime, hostingServer, information], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }
                return res.json({
                    success: true,
                    message: `The event ${name} has been successfully created!`
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
        const eventId = req.body.eventId;
        const name = req.body.name;
        const icon = req.body.icon;
        const eventDateTime = req.body.eventDateTime;
        const hostingServer = req.body.hostingServer;
        const information = req.body.information;

        // ...
        res.json({ success: true });
    });

    app.post(baseEndpoint + '/delete', (req, res, next) => {
        const eventId = req.body.eventId;

        try {
            db.query(`SELECT eventId FROM events WHERE eventId=?; DELETE FROM events WHERE eventId=?`, [eventId, eventId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results[0].length) {
                    return res.json({
                        success: false,
                        message: `The event with the id ${eventId} does not exist.`
                    }); 
                }

                return res.json({
                    success: true,
                    message: `The event with the id of ${eventId} has been successfully deleted.`
                });
            });

        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/publish', (req, res, next) => {
        const eventId = req.body.eventId;

        try {
            db.query(`select name, icon, eventDateTime, information, (select name from servers where serverId=hostingServer) as 'hostingServerName' from events where eventId=?; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId], function(error, results, fields) {
                if (error) {
                    return res.json({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results[0].length) {
                    return res.json({
                        success: false,
                        message: `The event with the id ${eventId} does not exist.`
                    }); 
                }

                // shadowolf: 
                // DONE: This is where the event will send a message to the `eventAnnouncements` indicated in config.json
                // WAITING: It will also create a scheduled event and amend the link to the event announcement.

                // TODO: Need to wait for Discord API to support the automation of scheduled event creation.     
                
                try {
                    const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
                    const channel = guild.channels.cache.get(config.discord.channels.eventAnnouncements);
                    const eventInfo = results[0][0];

                    const embed = new MessageEmbed()
                    .setTitle(`:calendar: NEW EVENT: ${eventInfo.name}`)
                    .setThumbnail(`${eventInfo.icon}`)
                    .setDescription(`${eventInfo.information}\n\n Event starting at ${moment(eventInfo.eventDateTime).format('MMMM Do YYYY, h:mm:ss a')} \n\n Hosted on ${eventInfo.hostingServerName}`)

                    channel.send({ embeds: [embed] });

                    return res.json({
                        success: true,
                        message: `The event with the id of ${eventId} has been successfully published.`
                    });                    
                } catch (error) {
                    console.log(error);

                    return res.json({
                        success: false,
                        message: `${error}`
                    });                    
                }
            });
        } catch (error) {
            res.json({
                success: false,
                message: `${error}`
            });
        }
    });

}
