import {hasPermission, setBannerCookie, postAPIRequest} from '../common'

export default function knowledgebaseApiRoute(app, config, lang) {
    const baseEndpoint = '/redirect/knowledgebase';

    app.post(baseEndpoint + '/section/create', async function(req, res) {
        if (!hasPermission('zander.web.knowledgebase', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}/api/knowledgebase/section/create`,
            req.body,
            `${process.env.siteAddress}/dashboard/knowledgebase`,
            res
        )

        setBannerCookie("success", lang.knowledgebase.sectionCreated, res);
        res.redirect(`${process.env.siteAddress}/dashboard/knowledgebase`);
    });

    app.post(baseEndpoint + '/section/update', async function(req, res) {
        if (!hasPermission('zander.web.knowledgebase', req, res))
            return;

            postAPIRequest(
                `${process.env.siteAddress}/api/knowledgebase/section/update`,
                req.body,
                `${process.env.siteAddress}/dashboard/knowledgebase`,
                res
            )
    
            setBannerCookie("success", lang.knowledgebase.sectionUpdated, res);
            res.redirect(`${process.env.siteAddress}/dashboard/knowledgebase`);
    });

    app.post(baseEndpoint + '/article/create', async function(req, res) {
        if (!hasPermission('zander.web.knowledgebase', req, res))
            return;

            postAPIRequest(
                `${process.env.siteAddress}/api/knowledgebase/article/create`,
                req.body,
                `${process.env.siteAddress}/dashboard/knowledgebase`,
                res
            )
    
            setBannerCookie("success", lang.knowledgebase.articleCreated, res);
            res.redirect(`${process.env.siteAddress}/dashboard/knowledgebase`);
    });

    app.post(baseEndpoint + '/article/update', async function(req, res) {
        if (!hasPermission('zander.web.knowledgebase', req, res))
            return;
        
        postAPIRequest(
            `${process.env.siteAddress}/api/knowledgebase/article/update`,
            req.body,
            `${process.env.siteAddress}/dashboard/knowledgebase`,
            res
        )

        setBannerCookie("success", lang.knowledgebase.articleUpdated, res);
        res.redirect(`${process.env.siteAddress}/dashboard/knowledgebase`);


    });
}