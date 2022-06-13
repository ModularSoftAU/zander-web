import {required, optional} from '../common'
import fetch from 'node-fetch';

export default function reportRedirectRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/report';

    app.post(baseEndpoint + '/create', async function(req, res) {
        const reportCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/create`;
        fetch(reportCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard`);
    });

    app.post(baseEndpoint + '/close', async function(req, res) {
        const reportCloseURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/report/close`;
        fetch(reportCloseURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard`);
    });

}