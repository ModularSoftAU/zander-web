import { expandString, isFeatureEnabled, required } from '../common';
import filter from '../../filter.json' assert { type: "json" };

export default function filterApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/filter';

    app.post(baseEndpoint, async function (req, res) {
        function expandString(string, filter) {
            var regexString = "";
            for (var i = 0; i < string.length; i++) {
                if (string[i] in filter.alias)
                    regexString += "[" + filter.alias[string[i]] + "]";
                else
                    regexString += string[i]
            }
            regexString = regexString.replace(".", "\\.");
            return regexString;
        }

        if (!features.filter.phrase && !features.filter.link)
            return isFeatureEnabled(false, res, lang);

        const content = required(req.body, "content", res);

        var bannedWords = [];
        if (features.filter.phrase)
            bannedWords = bannedWords.concat(filter.phrases);
        if (features.filter.link)
            bannedWords = bannedWords.concat(filter.links);

        var bannedRegex = [];
        bannedWords.forEach(bannedWord => {
            bannedRegex.push(new RegExp(expandString(bannedWord, filter)));
        });

        let responseSent = false;

        try {
            const wordList = content.split(" ");
            for (let i = 0; i < bannedRegex.length; i++) {
                const re = bannedRegex[i];
                for (let j = 0; j < wordList.length; j++) {
                    const word = wordList[j];
                    if (re.test(word)) {
                        res.send({
                            success: false,
                            message: lang.filter.phraseCaught
                        });
                        responseSent = true;
                        break;
                    }
                }
                if (responseSent) {
                    break;
                }
            }

            if (!responseSent) {
                res.send({
                    success: true,
                    message: `Content Clean`
                });
            }
        } catch (error) {
            console.log(error);

            res.send({
                success: false,
                message: lang.web.registrationError
            });
        }
    });
}