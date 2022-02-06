import socialProfileStratagies from '../../socialProfileStratagies.json'
import passport from 'passport';
// import { Strategy as DiscordStrategy } from "passport-discord"
import { Strategy as DiscordStrategy } from "@oauth-everything/passport-discord"

import fastifyPassport from 'fastify-passport'
import fastifySecureSession from 'fastify-secure-session'

export default function userApiRoute(app, config, db) {
    const baseEndpoint = config.siteConfiguration.apiRoute + '/user';

    app.post(baseEndpoint + '/create', async function(req, res) {
        const uuid = req.body.uuid;
        const username = req.body.username;

        try {
            // shadowolf
            // Check if user does not exist, we do this in case of testing we create multiple users on accident
            db.query(`SELECT * FROM users WHERE uuid=?`, [uuid], function(error, results, fields) {
                if (results[0]) {
                    return res.send({
                        success: false,
                        message: `This user already exists (somehow), terminating creation.`
                    });
                }

                // If user does not exist, create them
                db.query(`INSERT INTO users (uuid, username) VALUES (?, ?)`, [uuid, username], function(error, results, fields) {
                    if (error) {
                        return res.send({
                            success: false,
                            message: `${error}`
                        });
                    }
                    return res.send(`${username} (${uuid}) has been successfully created.`);
                });
            });
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.get(baseEndpoint + '/get', async function(req, res) {
        const username = req.query.username;
        
        try {
            db.query(`SELECT * FROM users WHERE uuid=(SELECT uuid FROM users WHERE username=?);`, [username], function(error, results, fields) {
                if (!results || !results.length) {
                    return res.send({
                        success: false,
                        message: `This user does not exist.`
                    });
                }
                
                res.send({
                    success: true,
                    data: results
                });
            });
        } catch (error) {
            return res.send({
                success: false,
                message: `${error}`
            });
        }
    });

    app.post(baseEndpoint + '/profile/edit', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/twitter', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/twitch', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/youtube', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/instagram', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/steam', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/github', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    app.post(baseEndpoint + '/profile/authenticate/spotify', async function(req, res) {
        const username = req.params.username;
        // TODO

        // ...
        res.send({ success: true });
    });

    // 
    // Discord
    // 
    passport.use(new DiscordStrategy({
        clientID: socialProfileStratagies.discord.clientId,
        clientSecret: socialProfileStratagies.discord.clientSecret,
        callbackURL: 'callbackURL',
        scope: socialProfileStratagies.discord.scopes,
        prompt: socialProfileStratagies.discord.prompt
    },
    function(accessToken, refreshToken, profile, cb) {
        console.log(`SUCCESS\n\n`);
        console.log(profile)
        console.log(cb)
    }));

    // app.get(baseEndpoint + '/profile/authenticate/discord', passport.authenticate("discord"));

    app.get(baseEndpoint + '/profile/authenticate/discord', { 
        preValidation: fastifyPassport.authenticate('discord', { authInfo: false }) },
        async () => 'hello world!'
    )      


    app.get(baseEndpoint + '/profile/authenticate/discord/callback', async function(req, res) {
        const username = req.params.username;

        // passport.authenticate('discord', {
        //     failureRedirect: '/'
        // }), function(req, res) {
        //     res.redirect('/secretstuff') // Successful auth
        // };

        // res.send({ success: true });
    });

    app.post(baseEndpoint + '/setting/:settingOption', async function(req, res) {
        const settingOption = req.params.settingOption;
        // TODO

        // ...
        res.send({ success: true });
    });

}