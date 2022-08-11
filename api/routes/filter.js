import {isFeatureEnabled, required} from '../common';
import filter from '../../filter.json' assert {type: "json"};

export default function filterApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/filter';

    function expandString(string, filter) {
        var regexString = "";
        for (var i = 0; i < string.length; i++) {
            // If the character does not have any aliases then just
            // use the character. Note, this is a regex character.
            if (string[i] in filter.alias)
                regexString += "[" + filter.alias[string[i]] + "]";
            else
                regexString += string[i]
        }
        regexString = regexString.replace(".", "\\.")
        return regexString
    }

    app.post(baseEndpoint, async function(req, res) {
        // Hack to show the error we expect when both are disabled
        if (!features.filter.phrase && !features.filter.link)
            return isFeatureEnabled(false, res, lang)
        
        const content = required(req.body, "content", res);

        var bannedWords = []
        if (features.filter.phrase)
            bannedWords = bannedWords.concat(filter.phrases)
        if (features.filter.link)
            bannedWords = bannedWords.concat(filter.links)
        
        var bannedRegex = []
        // Usually compiling regex on the fly like this isn't recommended.
        // You can compile regex once and then reuse it. Since performance
        // isn't a big deal and the word list is yet to expand, this will
        // suffice for now.
        bannedWords.forEach(bannedWord => {
            bannedRegex.push(new RegExp(expandString(bannedWord, filter)))
        })

        try {
            const wordList = content.split(" ");
            bannedRegex.forEach(re => {
                wordList.forEach(word => {
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

}