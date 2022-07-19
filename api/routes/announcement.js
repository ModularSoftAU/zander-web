import {isFeatureEnabled, required, optional} from '../common'

export default function announcementApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/announcement';

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.announcements, res, lang);
        const announcementSlug = optional(req.query, "announcementSlug");
        const announcementType = optional(req.query, "announcementType");
        const enabled = optional(req.query, "enabled");

        try {
            function getAnnouncements(dbQuery) {
                db.query(dbQuery, function(error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }

                    if (!results.length) {
                        return res.send({
                            success: false,
                            message: lang.annnouncement.noAnnouncements
                        });
                    }

                    res.send({
                        success: true,
                        data: results
                    });
                });
            }

            // Get Announcement by specific ID.
            if (announcementSlug) {
                let dbQuery = `SELECT * FROM announcements WHERE announcementSlug=${announcementSlug};`
                getAnnouncements(dbQuery);
            }

            // Get 1 web announcement
            if (announcementType === 'web') {
                let dbQuery = `SELECT * FROM announcements WHERE announcementType='web' ORDER BY RAND() LIMIT 1;`
                getAnnouncements(dbQuery);
            }

            // Get 1 tip announcement
            if (announcementType === 'tip') {
                let dbQuery = `SELECT * FROM announcements WHERE announcementType='tip' ORDER BY RAND() LIMIT 1;`
                getAnnouncements(dbQuery);
            }

            // Get 1 motd announcement
            if (announcementType === 'motd') {
                let dbQuery = `SELECT * FROM announcements WHERE announcementType='motd' ORDER BY RAND() LIMIT 1;`
                getAnnouncements(dbQuery);
            }

            // Show all public announcements
            if (enabled === 'show') {
                let dbQuery = `SELECT * FROM announcements WHERE enabled=1;`
                getAnnouncements(dbQuery);
            }

            // Show all hidden announcements
            if (enabled === 'hide') {
                let dbQuery = `SELECT * FROM announcements WHERE enabled=0;`
                getAnnouncements(dbQuery);
            }

            // Show all announcements
            if (enabled === 'all') {
                let dbQuery = `SELECT * FROM announcements;`
                getAnnouncements(dbQuery);
            }

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.announcements, res, lang);
        const announcementSlug = required(req.body, "announcementSlug", res);
        const enabled = required(req.body, "enabled", res);
        const announcementType = required(req.body, "announcementType", res);
        const body = optional(req.body, "body", res);
        const colourMessageFormat = optional(req.body, "colourMessageFormat", res);
        const link = optional(req.body, "link", res);

        const annnouncementCreatedLang = lang.annnouncement.annnouncementCreated;

        try {
            db.query(`INSERT INTO announcements (announcementSlug, enabled, body, announcementType, link, colourMessageFormat) VALUES (?, ?, ?, ?, ?, ?)`, [announcementSlug, enabled, body, announcementType, link, colourMessageFormat], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                res.send({
                    success: true,
                    alertType: "success",
                    content: annnouncementCreatedLang
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        isFeatureEnabled(features.announcements, res, lang);
        const announcementSlug = required(req.body, "announcementSlug", res);
        const body = required(req.body, "body", res);
        const motd = required(req.body, "motd", res);
        const tips = required(req.body, "tips", res);
        const web = required(req.body, "web", res);
        const link = optional(req.body, "link");
        const motdFormat = optional(req.body, "motdFormat");

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.announcements, res, lang);
        const announcementSlug = required(req.body, "announcementSlug", res);

        // ...
        res.send({ success: true });
    });

}