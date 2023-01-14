import {hasPermission, setBannerCookie, postAPIRequest} from '../common'

export default function applicationRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/application';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/application/create`,
            req.body,
            `${process.env.siteAddress}/dashboard/applications`,
            res
        )

        setBannerCookie("success", lang.applications.applicationCreated, res);
        res.redirect(`${process.env.siteAddress}/dashboard/applications`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/application/edit`,
            req.body,
            `${process.env.siteAddress}/dashboard/applications`,
            res
        )

        setBannerCookie("success", lang.applications.applicationEdited, res);
        res.redirect(`${process.env.siteAddress}/dashboard/applications`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/application/delete`,
            req.body,
            `${process.env.siteAddress}/dashboard/applications`,
            res
        )

        setBannerCookie("success", lang.applications.applicationDeleted, res);
        res.redirect(`${process.env.siteAddress}/dashboard/applications`);
    });

}