import {hasPermission, setBannerCookie, postAPIRequest} from '../common'
import fetch from 'node-fetch';

export default function reportRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/report';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.report', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/report/create`,
            req.body,
            `${process.env.siteAddress}/dashboard`,
            res
        )

        setBannerCookie("success", lang.report.reportCreated, res);
        res.redirect(`${process.env.siteAddress}/dashboard`);
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

        setBannerCookie("success", lang.report.reportClosed, res);
        res.redirect(`${process.env.siteAddress}/dashboard`);
    });

}