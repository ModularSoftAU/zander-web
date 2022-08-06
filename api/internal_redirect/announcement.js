import {hasPermission, setBannerCookie, postAPIRequest} from '../common'
import fetch from 'node-fetch';

export default function announcementRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/announcement';
    
    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcement/create`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("success", lang.announcement.announcementCreated, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;

        const announcementEditURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcement/edit`;
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

        setBannerCookie("success", lang.announcement.announcementEdited, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcement/delete`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("success", lang.announcement.announcementDeleted, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/enable', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcement/enable`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("success", lang.announcement.announcementEnabled, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/disable', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/announcement/disable`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("danger", lang.announcement.announcementDisabled, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/announcements`);
    });

}