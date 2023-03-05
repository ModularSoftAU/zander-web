import {setBannerCookie, postAPIRequest} from '../common'

export default function webRedirectRoute(app, config, lang) {
    const baseEndpoint = '/redirect/web';

    app.post(baseEndpoint + '/register', async function(req, res) {
        postAPIRequest(
            `${process.env.siteAddress}/api/web/register/create`,
            req.body,
            `${process.env.siteAddress}/register`,
            res
        )

        console.log(req.headers);
        console.log(req.cookies);

        res.redirect(`${process.env.siteAddress}/register`);
    });

}