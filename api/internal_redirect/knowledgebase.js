import {required, optional} from '../common'
import fetch from 'node-fetch';

export default function knowledgebaseApiRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/knowledgebase';

    app.post(baseEndpoint + '/section/create', async function(req, res) {
        const sectionCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/section/create`;
        fetch(sectionCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/knowledgebase`);
    });

    app.post(baseEndpoint + '/section/update', async function(req, res) {
        const sectionUpdateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/section/update`;
        fetch(sectionUpdateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/knowledgebase`);
    });

    app.post(baseEndpoint + '/article/create', async function(req, res) {
        const articleCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/create`;
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

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/knowledgebase`);
    });

    app.post(baseEndpoint + '/article/update', async function(req, res) {
        const articleUpdateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/update`;
        fetch(articleUpdateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/knowledgebase`);
    });
}