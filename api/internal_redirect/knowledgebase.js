import {required, optional} from '../common'
import fetch from 'node-fetch';

export default function knowledgebaseApiRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/knowledgebase';

    app.post(baseEndpoint + '/section/create', async function(req, res) {
        console.log(req.body)

        const sectionCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/section/create`;
        fetch(sectionCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/knowledgebase`);
    });

    app.post(baseEndpoint + '/section/update', async function(req, res) {
        const slug = required(req.body, "slug", res);
        const sectionSlug = required(req.body, "sectionSlug", res);
        const sectionName = required(req.body, "sectionName", res);
        const description = required(req.body, "description", res);
        const sectionIcon = required(req.body, "sectionIcon", res);
        const position = required(req.body, "position", res);
    });
}