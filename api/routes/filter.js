import {isFeatureEnabled, required} from '../common';
import filter from '../../filter.json' assert {type: "json"};

export default function filterApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/filter';

    app.post(baseEndpoint + '/phrase', async function(req, res) {
        function expandString(string, filter) {
            var regexString = "";
            for (var i = 0; i < string.length; i++) {
                regexString += "[" + filter.alias[string[i]] + "]";
            }
            return regexString
        }

        isFeatureEnabled(features.filter.phrase, res, lang);
        const content = required(req.body, "content", res);
        const phrases = filter.phrases;

        try {
            const wordContent = content.split(" ");
            phrases.forEach(phrase => {
                // Usually compiling rehex on the fly like this isn't recommended.
                // You can compile regex once and then reuse it. Since performance
                // isn't a big deal and the word list is yet to expand, this will
                // suffice for now.
                const re = new RegExp(expandString(phrase, filter))
                wordContent.forEach(word => {
                    if (re.test(word)) {
                        return res.send({
                            success: false,
                            message: lang.filter.phraseCaught
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
        function expandString(string, filter) {
            var regexString = "";
            for (var i = 0; i < string.length; i++) {
                regexString += "[" + filter.alias[string[i]] + "]";
            }
            return regexString
        }

        isFeatureEnabled(features.filter.link, res, lang);
        const content = required(req.body, "content", res);
        const links = filter.links;

        try {
            const linkContent = content.split(" ");
            links.forEach(link => {
                const re = new RegExp(expandString(link, filter))
                linkContent.forEach(link => {
                    if (re.test(link)) {
                        return res.send({
                            success: false,
                            message: lang.filter.linkCaught
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