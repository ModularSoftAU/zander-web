import {required, optional, hasPermission} from '../common'
import fetch from 'node-fetch';

export default function applicationRedirectRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/web';

    app.post(baseEndpoint + '/create', async function(req, res) {
        const registerCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/register/create`;
        fetch(registerCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/`);
    });

}