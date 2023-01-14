import {hasPermission, setBannerCookie, postAPIRequest} from '../common'
import fetch from 'node-fetch';

export default function knowledgebaseApiRoute(app, config, lang) {
    const baseEndpoint = config.siteConfiguration.redirectRoute + '/knowledgebase';

    app.post(baseEndpoint + '/section/create', async function(req, res) {
        if (!hasPermission('zander.web.knowledgebase', req, res))
            return;

        postAPIRequest(
            `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/section/create`,
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
                `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/section/update`,
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
                `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/create`,
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
            `${process.env.siteAddress}${config.siteConfiguration.apiRoute}/knowledgebase/article/update`,
            req.body,
            `${process.env.siteAddress}/dashboard/knowledgebase`,
            res
        )

        setBannerCookie("success", lang.knowledgebase.articleUpdated, res);
        res.redirect(`${process.env.siteAddress}/dashboard/knowledgebase`);


    });
}