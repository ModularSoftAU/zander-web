import {isFeatureEnabled, required, optional, generateLog} from '../common'

export default function announcementApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/announcement';

    app.get(baseEndpoint + '/get', async function(req, res) {
        isFeatureEnabled(features.announcements, res, lang);
        const announcementId = optional(req.query, "announcementId");
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
                            message: lang.announcement.noAnnouncements
                        });
                    }

                    res.send({
                        success: true,
                        data: results
                    });
                });
            }

            // Get Announcement by specific ID.
            if (req.query === 'announcementId') {
                let dbQuery = `SELECT * FROM announcements WHERE announcementId=${announcementId};`
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
            if (enabled === 1) {
                let dbQuery = `SELECT * FROM announcements WHERE enabled=1;`
                getAnnouncements(dbQuery);
            }

            // Show all hidden announcements
            if (enabled === 0) {
                let dbQuery = `SELECT * FROM announcements WHERE enabled=0;`
                getAnnouncements(dbQuery);
            }

            // Show all announcements
            let dbQuery = `SELECT * FROM announcements;`
            getAnnouncements(dbQuery);

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/create', async function(req, res) {
        isFeatureEnabled(features.announcements, res, lang);

        const actioningUser = required(req.body, "actioningUser", res);
        const enabled = required(req.body, "enabled", res);
        const announcementType = required(req.body, "announcementType", res);
        const body = optional(req.body, "body", res);
        const colourMessageFormat = optional(req.body, "colourMessageFormat", res);
        const link = optional(req.body, "link", res);

        try {
            db.query(`INSERT INTO announcements (enabled, body, announcementType, link, colourMessageFormat) VALUES (?, ?, ?, ?, ?, ?)`, [announcementSlug, enabled, body, announcementType, link, colourMessageFormat], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                generateLog(actioningUser, "SUCCESS", "ANNOUNCEMENT", `Created ${announcementId}`, res);

                res.send({
                    success: true,
                    alertType: "success",
                    content: lang.announcement.announcementCreated
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

        const actioningUser = required(req.body, "actioningUser", res);
        const announcementId = required(req.body, "announcementId", res);
        const enabled = required(req.body, "enabled", res);
        const announcementType = required(req.body, "announcementType", res);
        const body = optional(req.body, "body", res);
        const colourMessageFormat = optional(req.body, "colourMessageFormat", res);
        const link = optional(req.body, "link", res);

        console.log(req.body);

        try {
            db.query(`
                UPDATE announcements 
                    SET 
                        enabled=?,
                        announcementType=?,
                        body=?,
                        colourMessageFormat=?,
                        link=?
                    WHERE announcementSId=?;`,
                [
                    enabled,
                    announcementType,
                    body,
                    colourMessageFormat,
                    link,
                    announcementId
                ], function(error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }

                    generateLog(actioningUser, "SUCCESS", "ANNOUNCEMENT", `Edited ${announcementId}`, res);

                    return res.send({
                        success: true,
                        message: lang.announcement.announcementEdited
                    });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        isFeatureEnabled(features.announcements, res, lang);
        
        const announcementId = required(req.body, "announcementId", res);

        try {
            db.query(`DELETE FROM announcements WHERE announcementId=?;`, [announcementId], function(error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                generateLog(actioningUser, "WARNING", "ANNOUNCEMENT", `Deleted ${announcementId}`, res);

                return res.send({
                    success: true,
                    message: lang.announcement.announcementDeleted
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: `${error}`
            });
        }
    });
}