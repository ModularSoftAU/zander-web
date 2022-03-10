export default function dashboardEventSiteRoute(app, fetch, moment, config) {

    // 
    // Events
    // 
    app.get('/dashboard/events', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?published=all`;
        const response = await fetch(fetchURL);
        const apiData = await response.json();
                
        reply.view('dashboard/events/list', {
            "pageTitle": `Dashboard - Events`,
            config: config,
            apiData: apiData,
            moment: moment
        });
    });

    app.get('/dashboard/events/editor', async function(request, reply) {
        reply.view('dashboard/events/editor', {
            "pageTitle": `Dashboard - Event Editor`,
            config: config
        });
    });

    app.post('/dashboard/events/delete', async function(req, res) {
        const eventId = req.body.eventId;

        try {
            db.query(`SELECT eventId FROM events WHERE eventId=?; DELETE FROM events WHERE eventId=?`, [eventId, eventId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results[0].length) {
                    return res.send({
                        success: false,
                        message: `The event with the id ${eventId} does not exist.`
                    });
                }

                return res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/events`);
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post('/dashboard/events/publish', async function(req, res) {
        const eventId = req.body.eventId;

        try {
            db.query(`SELECT * FROM events where eventId=? AND published=?; select name, icon, eventDateTime, information, (select name from servers where serverId=hostingServer) as 'hostingServerName' from events where eventId=?; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId, `1`, eventId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                // shadowolf: 
                // DONE: This is where the event will send a message to the `eventAnnouncements` indicated in config.json
                // It will also create a scheduled event and amend the link to the event announcement.

                try {
                    const guild = DiscordClient.guilds.cache.get(config.discord.serverId);
                    const eventInfo = results[1][0];

                    db.query(`SELECT * FROM events where eventId=? AND published=?; select name, icon, eventDateTime, information, (select name from servers where serverId=hostingServer) as 'hostingServerName' from events where eventId=?; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId, `1`, eventId], function(error, results, fields) {
                        if (error) {
                            return res.send({
                                success: false,
                                message: `${error}`
                            });
                        }

                        // Create Scheduled Event
                        guild.scheduledEvents.create({
                            name: `${eventInfo.name}`,
                            scheduledStartTime: `${eventInfo.eventDateTime}`,
                            privacyLevel: 'GUILD_ONLY',
                            description: `Hosted on ${eventInfo.hostingServerName}\n${eventInfo.information}`,
                            entityType: 'VOICE',
                            channel: guild.channels.cache.get(`${eventInfo.guildEventChannel}`)
                        })

                        // Event will send a message to the `eventAnnouncements` indicated in config.json
                        const channel = guild.channels.cache.get(config.discord.channels.eventAnnouncements);

                        const embed = new MessageEmbed()
                            .setTitle(`:calendar: NEW EVENT: ${eventInfo.name}`)
                            .setThumbnail(`${eventInfo.icon}`)
                            .setDescription(`${eventInfo.information}\n\n Event starting at ${moment(eventInfo.eventDateTime).format('MMMM Do YYYY, h:mm:ss a')}\nHosted on ${eventInfo.hostingServerName}`)
                            .setFooter(`To stay notified of when the event will begin, mark yourself as Interested in the Events tab on the sidebar.`)

                        channel.send({ embeds: [embed] });

                        return res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/events`);
                    });
                } catch (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }
            });
        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

}