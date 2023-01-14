import {hasPermission, setBannerCookie, postAPIRequest} from '../common'

export default function serverRedirectRoute(app, config, lang) {
    const baseEndpoint = '/redirect/server';
    
    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.server', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/server/create`,
            req.body,
            `${process.env.siteAddress}/dashboard/servers`,
            res
        )

        setBannerCookie("success", lang.server.serverCreated, res);
        res.redirect(`${process.env.siteAddress}/dashboard/servers`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.server', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/server/edit`,
            req.body,
            `${process.env.siteAddress}/dashboard/servers`,
            res
        )

        setBannerCookie("success", lang.server.serverEdited, res);
        res.redirect(`${process.env.siteAddress}/dashboard/servers`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.server', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/server/delete`,
            req.body,
            `${process.env.siteAddress}/dashboard/servers`,
            res
        )

        setBannerCookie("success", lang.server.serverDeleted, res);
        res.redirect(`${process.env.siteAddress}/dashboard/servers`);
    });

}