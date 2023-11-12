import {hasPermission, setBannerCookie, postAPIRequest} from '../common'

export default function applicationRedirectRoute(app, config, lang) {
    const baseEndpoint = '/redirect/application';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/application/create`,
            req.body,
            `${process.env.siteAddress}/dashboard/applications`,
            res
        )

        res.redirect(`${process.env.siteAddress}/dashboard/applications`);

        return res;
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/application/edit`,
            req.body,
            `${process.env.siteAddress}/dashboard/applications`,
            res
        )

        res.redirect(`${process.env.siteAddress}/dashboard/applications`);

        return res;
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/application/delete`,
            req.body,
            `${process.env.siteAddress}/dashboard/applications`,
            res
        )

        res.redirect(`${process.env.siteAddress}/dashboard/applications`);

        return res;
    });

}