import {required, optional} from '../common'
import fetch from 'node-fetch';

export default function serverRedirectRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/server';

    app.post(baseEndpoint + '/create', async function(req, res) {
        const serverCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/create`;
        fetch(serverCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/servers`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        const serverEditURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/edit`;
        fetch(serverEditURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/servers`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        const articleCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/server/delete`;
        fetch(articleCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/servers`);
    });

}