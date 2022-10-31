import { isFeatureWebRouteEnabled, setBannerCookie, getGlobalImage } from "../api/common";
import oauth2 from "@fastify/oauth2";

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
		callbackUri: `${config.siteConfiguration.siteAddress}/user/oauth/discord/callback` // this URL must be exposed
	})


	// 
	// 
	// 
	app.get('/user/oauth/discord/callback', async function (request, reply) {
		if (!isFeatureWebRouteEnabled(features.web.login, request, reply, features))
			return;
		
		console.log(`this is discord oauth callback`);

		const token = await this.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)

		// in async handler it is possible to just return the payload!
		return token
	});

	// app.post('/login', async function (req, res) {
	// 	if (!isFeatureWebRouteEnabled(features.web.login, req, res, features))
	// 		return;

	// });

}