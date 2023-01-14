import { isFeatureWebRouteEnabled, setBannerCookie, getGlobalImage } from "../api/common";
import oauth2 from "@fastify/oauth2";
import { linkUserDiscordID, unlinkUserDiscordID } from "../interfaces/userInterface";

export default function userSiteRoute(app, client, fetch, moment, config, db, features, lang) {

	// 
	// Discord oAUTH
	// 
	app.register(oauth2, {
		name: 'discordOAuth2',
		credentials: {
			client: {
				id: process.env.discordClientId,
				secret: process.env.discordClientSecret
			},
			auth: oauth2.DISCORD_CONFIGURATION
		},
		scope: ['identify'],
		startRedirectPath: '/user/oauth/discord',
		callbackUri: `${process.env.siteAddress}/user/oauth/discord/callback` // this URL must be exposed
	})


	// 
	// Discord
	// Callback to connect ID to profile
	// 
	app.get('/user/oauth/discord/callback', async function (req, res) {
		if (!isFeatureWebRouteEnabled(features.web.login, req, res, features))
			return;
		
		const token = await this.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

		const response = await fetch(`https://discord.com/api/users/@me`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${token.access_token}`
			}
		});

		const data = await response.json();
		let discordID = data.id;

		if (discordID) {
			linkUserDiscordID(discordID, req, res);
			setBannerCookie("success", "The Discord account is now connected.", res);
			res.redirect(`${process.env.siteAddress}/profile/edit`);
		} else {
			setBannerCookie("danger", "This didn't work, try again later.", res);
			res.redirect(`${process.env.siteAddress}/profile/edit`);
		}
	});

	// 
	// Discord
	// Callback to disconnect ID to profile
	// 
	app.get(`/user/oauth/discord/disconnect/:discordId`, async function (req, res) {
		if (!isFeatureWebRouteEnabled(features.web.login, req, res, features))
			return;

		const userDiscordId = req.params.discordId;
		
		unlinkUserDiscordID(userDiscordId, req, res);
		setBannerCookie("success", "The Discord account is now connected.", res);
		res.redirect(`${process.env.siteAddress}/profile/edit`);
	});

}