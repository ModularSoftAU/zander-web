import {setBannerCookie, postAPIRequest} from '../common'
import fetch from 'node-fetch';

export default function userRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/user';

    app.get(baseEndpoint + '/profile/platform/discord', async function(req, res) {
        // postAPIRequest(
        //     `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/user/profile/platform/discord/callback`,
        //     req.body,
        //     `${config.siteConfiguration.siteAddress}/`,
        //     res
        // )

        const tokenType = null;
        const accessToken = req.query.code;

        console.log(req.query);
        console.log(`Route is operational`);

        const response = await fetch('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${tokenType} ${accessToken}`,
            },
        });
        const data = await response.json();

        console.log(data);

        setBannerCookie("success", lang.report.reportCreated, res);
        res.redirect(`${config.siteConfiguration.siteAddress}/user/profile/edit`);
    });

}