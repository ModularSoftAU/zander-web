import {hasPermission, setBannerCookie, postAPIRequest} from '../common'

export default function eventRedirectRoute(app, config, lang) {
    const baseEndpoint = '/redirect/event';

    app.post(baseEndpoint + '/create', async function(req, res) {
        if (!hasPermission('zander.web.event', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/event/create`,
            req.body,
            `${process.env.siteAddress}/dashboard`,
            res
        )

        res.redirect(`${process.env.siteAddress}/dashboard/events`);
    });

    app.post(baseEndpoint + '/edit', async function (req, res) {
        if (!hasPermission('zander.web.event', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/event/edit`,
            req.body,
            `${process.env.siteAddress}/dashboard`,
            res
        )

        res.redirect(`${process.env.siteAddress}/dashboard/events`);
    });

    app.post(baseEndpoint + '/delete', async function (req, res) {
        if (!hasPermission('zander.web.event', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/event/delete`,
            req.body,
            `${process.env.siteAddress}/dashboard`,
            res
        )

        res.redirect(`${process.env.siteAddress}/dashboard/events`);
    });

    app.post(baseEndpoint + '/publish', async function (req, res) {
        if (!hasPermission('zander.web.event', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/event/publish`,
            req.body,
            `${process.env.siteAddress}/dashboard`,
            res
        )

        res.redirect(`${process.env.siteAddress}/dashboard/events`);
    });

}