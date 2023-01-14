import {hasPermission, setBannerCookie, postAPIRequest} from '../common'

export default function announcementRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/announcement';
    
    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/announcement/create`,
            req.body,
            `${process.env.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("success", lang.announcement.announcementCreated, res);
        res.redirect(`${process.env.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/announcement/edit`,
            req.body,
            `${process.env.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("success", lang.announcement.announcementEdited, res);
        res.redirect(`${process.env.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/announcement/delete`,
            req.body,
            `${process.env.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("success", lang.announcement.announcementDeleted, res);
        res.redirect(`${process.env.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/enable', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/announcement/enable`,
            req.body,
            `${process.env.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("success", lang.announcement.announcementEnabled, res);
        res.redirect(`${process.env.siteAddress}/dashboard/announcements`);
    });

    app.post(baseEndpoint + '/disable', async function(req, res) {
        if (!hasPermission('zander.web.announcements', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/announcement/disable`,
            req.body,
            `${process.env.siteAddress}/dashboard/announcements`,
            res
        )

        setBannerCookie("danger", lang.announcement.announcementDisabled, res);
        res.redirect(`${process.env.siteAddress}/dashboard/announcements`);
    });

}