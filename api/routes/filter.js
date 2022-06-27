import {isFeatureEnabled, required, optional} from '../common';
import filter from '../../filter.json' assert {type: "json"};

export default function webApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/filter';

    app.post(baseEndpoint + '/phrase', async function(req, res) {
        isFeatureEnabled(features.filter.phrase, res, lang);
        const content = required(req.body, "content", res);
        const phrases = filter.phrases;

        try {
            const wordContent = content.split(" ");
            var bannedshouldBreak = false;

            phrases.forEach(phrase => {
                wordContent.forEach(word => {
                    if (word.toLowerCase() === phrase.toLowerCase()) {
                        bannedshouldBreak = true;
                        
                        return res.send({
                            success: false,
                            message: `Content Unclean: Phrase '${phrase}' matched`
                        });
                    }              
                });
            });

            return res.send({
                success: true,
                message: `Content Clean`
            });
        } catch (error) {
            console.log(error);

            return res.send({
                success: false,
                message: lang.web.registrationError
            });
        }
    });

    app.post(baseEndpoint + '/link', async function(req, res) {
        isFeatureEnabled(features.filter.link, res, lang);
        const content = required(req.body, "content", res);
        const links = filter.links;

        try {
            const linkWordContent = content.split(" ");
            var linkshouldBreak = false;

            links.forEach(link => {
                linkWordContent.forEach(word => {
                    if (word.toLowerCase() === link.toLowerCase()) {
                        linkshouldBreak = true;
                        
                        return res.send({
                            success: false,
                            message: `Content Unclean: Link '${link}' matched`
                        });
                    }              
                });
            });

            return res.send({
                success: true,
                message: `Content Clean`
            });
        } catch (error) {
            console.log(error);

            return res.send({
                success: false,
                message: lang.web.registrationError
            });
        }
    });

}