import { postAPIRequest } from '../common'

export default function webRedirectRoute(app, config, lang) {
    const baseEndpoint = '/redirect/web';

    app.post(baseEndpoint + '/register', async function (req, res) {
        await postAPIRequest(
            `${process.env.siteAddress}/api/web/register/create`,
            req.body,
            `${process.env.siteAddress}/register`,
            res
        )

        res.redirect(`${process.env.siteAddress}/register`);

        return res;
    });

}