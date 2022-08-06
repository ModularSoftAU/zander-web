import { setBannerCookie } from '../common'
import fetch from 'node-fetch';

export default function applicationRedirectRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/web';

    app.post(baseEndpoint + '/register', async function(req, res) {
        const registerCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/web/register/create`;
        await fetch(registerCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => setBannerCookie(json.alertType, json.alertContent, res));

        res.redirect(`${config.siteConfiguration.siteAddress}/register`);
    });

}