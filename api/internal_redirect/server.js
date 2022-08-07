import {hasPermission, setBannerCookie, postAPIRequest} from '../common'
import fetch from 'node-fetch';

export default function serverRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/server';
    
    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.server', req, res))
            return;

        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/create`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/servers`,
            res
        )

        setBannerCookie("success", lang.server.serverCreated, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/servers`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.server', req, res))
            return;

        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/edit`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/servers`,
            res
        )

        setBannerCookie("success", lang.server.serverEdited, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/servers`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.server', req, res))
            return;

        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/delete`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/servers`,
            res
        )

        setBannerCookie("success", lang.server.serverDeleted, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/servers`);
    });

}