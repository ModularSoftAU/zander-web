import {hasPermission, setBannerCookie} from '../common'
import fetch from 'node-fetch';

export default function announcementRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/announcements';
    
    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;

        const announcementCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcements/create`;
        fetch(announcementCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        setBannerCookie("success", lang.announcement.annnouncementCreated, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;

        const announcementEditURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcements/edit`;
        fetch(announcementEditURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        setBannerCookie("success", lang.annnouncement.annnouncementEdited, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;

        const announcementDeleteURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcements/delete`;
        fetch(announcementDeleteURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        setBannerCookie("success", lang.announcement.annnouncementDeleted, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/announcements`);
    });

}