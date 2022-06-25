import {required, optional, hasPermission} from '../common'
import fetch from 'node-fetch';

export default function reportRedirectRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/report';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        const reportCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/create`;
        fetch(reportCreateURL, {
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

    app.post(baseEndpoint + '/close', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        const reportCloseURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/close`;
        fetch(reportCloseURL, {
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