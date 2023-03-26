import {setBannerCookie, postAPIRequest} from '../common'

export default function userRedirectRoute(app, config, lang) {
    const baseEndpoint = '/redirect/user';

    app.post(baseEndpoint + '/profile/update', async function (req, res) {
        postAPIRequest(
            `${process.env.siteAddress}/api/user/profile/update`,
            req.body,
            `${process.env.siteAddress}/profile/edit`,
            res
        )

        res.redirect(`${process.env.siteAddress}/profile/edit`);
    });
}