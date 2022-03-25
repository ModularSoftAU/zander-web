import bcrypt from 'bcrypt';

export default function webApiRoute(app, config, db, features, lang) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/web';

    app.post(baseEndpoint + '/register/create', async function(req, res) {
        if (features.web == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;
        const confirmPassword = req.body.confirmPassword;

        db.query(`select * from users where username=?; select * from users where email=?;`, [username, email], async function (err, results) {
            if (err) {
                throw err;
            }

            // User has not logged in before.
            if (!results[0].length) {
                return res.send({
                    success: false,
                    message: `You have not logged in before. You are required to login before becoming a community site member. You can jump on and play here: ${config.siteConfiguration.siteAddress}/play`
                });
            }

            // Make sure email is not being used on another account
            if (!results[1]) {
                return res.send({
                    success: false,
                    message: `The email you have provided is already in use, please enter another email and try again.`
                });
            }

            // Check if passwords match
            if (password != confirmPassword) {
                return res.send({
                    success: false,
                    message: `The password you have provided does not match. Please try again.`
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
                            message: `There was an error in registration, please try again later.`
                        });
                    }

                    // Success, generating account now.
                    return res.send({
                        success: true,
                        message: `You are now successfully registered. Please go back and login to get started!`
                    });
                });

            } catch (error) {
                console.log(error);

                return res.send({
                    success: false,
                    message: `There was an error in registration, please try again later.`
                });
            }
        });
    });

    app.post(baseEndpoint + '/register/verify', async function(req, res) {
        if (features.web == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }

        const username = req.body.username;
        const verificationToken = req.body.verificationToken;

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/forgot', async function(req, res) {
        if (features.web == false) {
            return res.send({
                success: false,
                message: `${lang.api.featureDisabled}`
            });
        }
        
        const username = req.body.username;
        // TODO

        // ...
        res.send({ success: true });
    });

}