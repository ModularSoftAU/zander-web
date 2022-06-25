import fetch from 'node-fetch';

export default function applicationRedirectRoute(app, config) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/application';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        const applicationCreateURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/create`;
        fetch(applicationCreateURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    });

    app.post(baseEndpoint + '/edit', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        const applicationEditURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/edit`;
        fetch(applicationEditURL, {
            method: 'POST',
            body: JSON.stringify(req.body),
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': process.env.apiKey
            }
        })
        .then(res => res.json())
        .then(json => console.log(json));

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    });

    app.post(baseEndpoint + '/delete', async function(req, res) {
        if (!hasPermission('zander.web.application', req, res))
            return;

        try {
            const applicationDeleteURL = `${config.siteConfiguration.siteAddress}${config.siteConfiguration.apiRoute}/application/delete`;
            fetch(applicationDeleteURL, {
                method: 'POST',
                body: JSON.stringify(req.body),
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': process.env.apiKey
                }
            })
            .then(res => res.json())
            .then(json => console.log(json));
            
        } catch (error) {
            console.log(error);
        }

        res.redirect(`${config.siteConfiguration.siteAddress}/dashboard/applications`);
    });

}