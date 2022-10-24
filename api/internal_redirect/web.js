import {setBannerCookie, postAPIRequest} from '../common'

export default function webRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/web';

    app.post(baseEndpoint + '/register', async function(req, res) {
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/web/register/create`,
            req.body,
            `${config.siteConfiguration.siteAddress}/register`,
            res
        )

        setBannerCookie("success", lang.report.reportCreated, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/register`);
    });

}