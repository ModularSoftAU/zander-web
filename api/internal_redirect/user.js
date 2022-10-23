import {setBannerCookie, postAPIRequest} from '../common'

export default function userRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/user';

    app.get(baseEndpoint + '/profile/platform/discord', async function(req, res) {
        postAPIRequest(
            `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/user/profile/platform/discord/callback`,
            req.body,
            `${config.siteConfiguration.siteAddress}/user/profile/edit`,
            res
        )

        setBannerCookie("success", lang.report.reportCreated, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/user/profile/edit`);
    });

}