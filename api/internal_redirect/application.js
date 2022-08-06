import {hasPermission, setBannerCookie, postAPIRequest} from '../common'
import fetch from 'node-fetch';

export default function applicationRedirectRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/application';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;
        
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/create`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/applications`,
            res
        )

        setBannerCookie("success", lang.applications.applicationCreated, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;
        
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/edit`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/applications`,
            res
        )

        setBannerCookie("success", lang.applications.applicationEdited, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/delete`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard/applications`,
            res
        )

        setBannerCookie("success", lang.applications.applicationDeleted, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    });

}