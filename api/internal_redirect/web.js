import {setBannerCookie, postAPIRequest} from '../common'

export default function webRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/web';

    app.post(baseEndpoint + '/register', async function(req, res) {
        postAPIRequest(
            `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/web/register/create`,
            req.body,
            `${process.env.siteAddress}/register`,
            res
        )

        setBannerCookie("success", lang.report.reportCreated, res);
        res.redirect(`${process.env.siteAddress}/register`);
    });

}