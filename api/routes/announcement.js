import {isFeatureEnabled, required, optional} from '../common'

export default function announcementApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/announcement';

    app.post(baseEndpoint + '/create', async function(req, res) {
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