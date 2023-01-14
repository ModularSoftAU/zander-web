import {setBannerCookie, postAPIRequest} from '../common'
import fetch from 'node-fetch';

export default function userRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/user';

    // app.get(baseEndpoint + '/profile/platform/discord', async function(req, res) {
    //     const code = req.query.code;

    //     let postBody = {
    //         "client_id": process.env.discordClientId,
    //         "client_secret": process.env.discordClientSecret,
    //         "grant_type": "authorization_code",
    //         "code": code,
    //         "redirect_uri": process.env.siteAddress + config.siteConfiguration.redirectRoute + '/user/profile/platform/discord/attach'
    //     }

    //     const response = await fetch(`https://discord.com/api/oauth2/token`, {
    //         method: 'POST',
    //         body: JSON.stringify(postBody),
    //         headers: {
    //             'Content-Type': 'application/x-www-form-urlencoded',
    //             'Accept': 'application/json'
    //         }
    //     });

    //     const data = await response.json();

    //     console.log(data);

    //     setBannerCookie("success", lang.report.reportCreated, res);
    //     res.redirect(`${process.env.siteAddress}/`);
    // });
}