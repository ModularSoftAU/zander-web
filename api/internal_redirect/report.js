import {required, optional, hasPermission} from '../common'
import fetch from 'node-fetch';

export default function reportRedirectRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/report';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;
        
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/create`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard`,
            res
        )

        setBannerCookie("success", lang.report.reportCreated, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard`);
    });

    app.post(baseEndpoint + '/close', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/close`,
            req.body,
            `${config.siteConfiguration.siteAddress}/dashboard`,
            res
        )

        setBannerCookie("success", lang.report.reportClosed, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard`);
    });

}