import bcrypt from 'bcrypt';
import {isFeatureEnabled, required} from '../common'

export default function webApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/web';

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
            if (results[0].length < 1) {
                return res.send({
                    success: false,
                    alertType: "warning",
                    alertContent: notLoggedInBeforeLang.replace("%SITEADDRESS%", config.siteConfiguration.siteAddress)
                });
            }

            // Make sure email is not being used on another account
            console.log(results[1]);

            if (!results[1].length > 1) {
                return res.send({
                    success: false,
                    alertType: "warning",
                    alertContent: lang.web.emailAlreadyInUse
                });
            }

            // Check if passwords match
            if (password != confirmPassword) {
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

                db.query(`UPDATE users SET password=?, email=? where username=?;`, [hashpassword, email, username], async function (err, results) {
                    if (err) {
                        console.log(err);

                        return res.send({
                            success: false,
                            alertType: "danger",
                            alertContent: lang.web.registrationError
                        });
                    }

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
                "siteAddress": config.siteConfiguration.siteAddress
            }
        });
    });

}