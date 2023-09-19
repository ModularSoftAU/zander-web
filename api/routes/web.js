import bcrypt from 'bcrypt';
import { doesPasswordMatch, hasEmailBeenUsed, hasUserJoinedBefore } from '../../controllers/userController';
import {generateLog, hashEmail, isFeatureEnabled, required, setBannerCookie} from '../common'

export default async function webApiRoute(app, config, db, features, lang) {
    const baseEndpoint = '/api/web';

    app.post(baseEndpoint + '/register/create', async function(req, res) {
        isFeatureEnabled(features.web.register, res, lang);

        const username = required(req.body, "username", res);
        const email = required(req.body, "email", res);
        const password = required(req.body, "password", res);
        const confirmPassword = required(req.body, "confirmPassword", res);

        const notLoggedInBeforeLang = lang.web.notLoggedInBefore

        db.query(`select * from users where username=?; select * from users where email=?;`, [username, email], async function (err, results) {
            if (err) {
                throw err;
            }

            // User has not logged in before.
            let userJoinBefore = await hasUserJoinedBefore(username);
            if (!userJoinBefore) {
                setBannerCookie(`warning`, `This is a test`, res);
                
                return res.send({
                    success: false,
                    alertType: "warning",
                    alertContent: notLoggedInBeforeLang.replace("%SITEADDRESS%", process.env.siteAddress)
                });
            }

            let emailBeenUsed = await hasEmailBeenUsed(email)
            if (emailBeenUsed) {
                return res.send({
                    success: false,
                    alertType: "warning",
                    alertContent: lang.web.emailAlreadyInUse
                });
            }

            // Check if passwords match
            let passwordMatch = await doesPasswordMatch(password, confirmPassword);
            if (!passwordMatch) {
                return res.send({
                    success: false,
                    alertType: "danger",
                    alertContent: lang.web.passwordDoesNotMatch
                });                
            }

            // Hash password and enter into the database.
            try {
                const salt = await bcrypt.genSalt();
                let hashpassword = await bcrypt.hash(password, salt);

                db.query(`UPDATE users SET password=?, email=?, emailHash=? WHERE username=?;`, [hashpassword, email, await hashEmail(email), username], async function (err, results) {
                    if (err) {
                        console.log(err);

                        return res.send({
                            success: false,
                            alertType: "danger",
                            alertContent: lang.web.registrationError
                        });
                    }

                    generateLog(null, "INFO", "WEB", `New website registration ${username}`, res);

                    // Success, generating account now.
                    return res.send({
                        success: true,
                        alertType: "success",
                        alertContent: lang.web.registrationSuccess
                    });
                });

            } catch (error) {
                console.log(error);

                return res.send({
                    success: false,
                    alertType: "danger",
                    alertContent: lang.web.registrationError
                });
            }
        });
    });

    app.get(baseEndpoint + '/configuration', async function(req, res) {
        // There is no isFeatureEnabled() due to being a critical endpoint.

        return res.send({
            success: true,
            data: {
                "siteName": config.siteConfiguration.siteName,
                "siteAddress": process.env.siteAddress
            }
        });
    });

    app.get(baseEndpoint + '/statistics', async function(req, res) {
        // There is no isFeatureEnabled() due to being a critical endpoint.

        db.query(`
            SELECT COUNT(*) AS communityMembers FROM users;
            SELECT CONVERT(SUM(TIMESTAMPDIFF(minute, sessionStart, sessionEnd)), time) AS timePlayed FROM gamesessions;
            SELECT COUNT(DISTINCT(u.uuid)) totalStaff FROM userRanks ur JOIN ranks r ON ur.rankSlug = r.rankSlug JOIN users u ON u.uuid = ur.uuid WHERE r.isStaff = 1 AND u.disabled = 0;
        `, async function (err, results) {
            if (err) {
                console.log(err);
            }

            // General
            let communityMembers = results[0][0].communityMembers;
            let timePlayed = results[1][0].timePlayed;
            let staffMembers = results[2][0].totalStaff;

            // Punishments
            
            
            return res.send({
                success: true,
                data: {
                    general: {
                        "communityMembers": communityMembers,
                        "timePlayed": timePlayed,
                        "staffMembers": staffMembers,
                    },
                    punishments: {

                    }
                }
            });
        });
    });

    app.get(baseEndpoint + '/logs/get', async function (req, res) {
        try {
            db.query(`SELECT logId, creatorId, (SELECT username FROM users WHERE userId=creatorId) AS 'actionedUsername', logFeature, logType, description, actionedDateTime FROM logs ORDER BY actionedDateTime DESC;`, function (error, results, fields) {
                if (error) {
                    return res.send({
                        success: false,
                        message: `${error}`
                    });
                }

                if (!results.length) {
                    return res.send({
                        success: false,
                        message: `There are no logs`
                    });
                }

                res.send({
                    success: true,
                    data: results
                });
            });

        } catch (error) {
            res.send({
                success: false,
                message: error
            });
        }
    });

}