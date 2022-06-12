import {required, optional} from '../common'
import fetch from 'node-fetch';

export default function applicationRedirectRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/application';

    app.post(baseEndpoint + '/create', async function(req, res) {
        const applicationCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/create`;
        fetch(applicationCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    });

    // app.post(baseEndpoint + '/edit', async function(req, res) {
    //     const applicationEditURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/edit`;
    //     fetch(applicationEditURL, {
    //         method: 'POST',
    //         body: JSON.stringify(req.body),
    //         headers: { 'Content-Type': 'application/json' }
    //     })
    //     .then(res => res.json())
    //     .then(json => console.log(json));

    //     res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    // });

    // app.post(baseEndpoint + '/delete', async function(req, res) {
    //     const applicationCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/delete`;
    //     fetch(applicationCreateURL, {
    //         method: 'POST',
    //         body: JSON.stringify(req.body),
    //         headers: { 'Content-Type': 'application/json' }
    //     })
    //     .then(res => res.json())
    //     .then(json => console.log(json));

    //     res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    // });

}