import {hasPermission, setBannerCookie, postAPIRequest} from '../common'

export default function reportRedirectRoute(app, config, lang) {
    const baseEndpoint = '/redirect/report';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.report', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/report/create`,
            req.body,
            `${process.env.siteAddress}/report`,
            res
        )

        res.redirect(`${process.env.siteAddress}/`);
    });

    app.post(baseEndpoint + '/close', async function(req, res) {
        if (!hasPermission('zander.web.report', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/report/close`,
            req.body,
            `${process.env.siteAddress}/dashboard`,
            res
        )

        res.redirect(`${process.env.siteAddress}/dashboard`);
    });

}