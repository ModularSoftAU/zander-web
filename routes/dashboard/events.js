export default function dashboardEventSiteRoute(app, fetch, moment, config, db, features, lang) {
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
            moment: moment,
            features: features
        });
    });

    // 
    // Events
    // Create Event
    // 
    app.get('/dashboard/events/create', async function(request, reply) {
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visible=all`;
        const response = await fetch(fetchURL);
        const serverApiData = await response.json();
                
        reply.view('dashboard/events/editor', {
            "pageTitle": `Dashboard - Event Creator`,
            config: config,
            serverApiData: serverApiData.data,
            type: "create",
            features: features
        });
    });

    // 
    // Events
    // Edit an existing event
    // 
    app.get('/dashboard/events/edit', async function(request, reply) {
        const eventId = request.query.id;
        const fetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/event/get?id=${eventId}`;
        const response = await fetch(fetchURL);
        const eventApiData = await response.json();

        const serverFetchURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/get?visible=all`;
        const serverResponse = await fetch(serverFetchURL);
        const serverApiData = await serverResponse.json();

        reply.view('dashboard/events/editor', {
            "pageTitle": `Dashboard - Event Editor`,
            config: config,
            eventApiData: eventApiData.data[0],
            serverApiData: serverApiData.data,
            moment: moment,
            type: "edit",
            features: features
        });
    });

    // 
    // Events
    // Delete an existing event
    // 
    app.post('/dashboard/events/delete', async function(request, reply, db) {
        // db object can't reach here?
        const eventId = request.body.eventId;

        try {
            db.query(`SELECT eventId FROM events WHERE eventId=?; DELETE FROM events WHERE eventId=?;`, [eventId, eventId], function(error, results, fields) {
                if (error) {
                    console.log(error);
                    return reply.send({
                        success: false,
                        message: `${error}`
                    });
                }

                return reply.send({
                    success: true,
                    message: `The event with the id ${eventId} has been deleted.`
                });
            });

        } catch (error) {
            console.log(error);
            reply.send({
                success: false,
                message: `${error}`
            });
        }
    });

    // 
    // Events
    // Publish an existing event
    // NOTE: Once an event is published, it cannot be unpublished, it would have to be deleted.
    // 
    app.post('/dashboard/events/publish', async function(request, reply) {
        const eventId = request.body.eventId;

        try {
            db.query(`SELECT * FROM events where eventId=? AND published=?; select name, icon, eventDateTime, information, (select name from servers where serverId=hostingServer) as 'hostingServerName' from events where eventId=?; UPDATE events SET published=? WHERE eventId=?`, [eventId, `1`, eventId, `1`, eventId], function(error, results, fields) {
                if (error) {
                    return reply.send({
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
                            return reply.send({
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

                        return reply.redirect(`${config.siteConfiguration.siteAddress}/dashboard/events`);
                    });
                } catch (error) {
                    return reply.send({
                        success: false,
                        message: `${error}`
                    });
                }
            });
        } catch (error) {
            reply.send({
                success: false,
                message: `${error}`
            });
        }
    });
}