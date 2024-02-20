import dotenv from "dotenv";
dotenv.config();
import qs from "querystring";
import {
  isFeatureWebRouteEnabled,
  setBannerCookie,
  getGlobalImage,
} from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";
import { UserGetter, getProfilePicture, getUserPermissions } from "../controllers/userController";

export default function sessionSiteRoute(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  //
  // Session
  //
  app.get("/login", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features))
      return;

    // Redirect to Discord for authentication
    const params = {
      client_id: process.env.discordClientId,
      redirect_uri: `${process.env.siteAddress}/login/callback`,
      response_type: "code",
      scope: "identify",
    };

    const authorizeUrl = `https://discord.com/api/oauth2/authorize?${qs.stringify(
      params
    )}`;

    return res.redirect(authorizeUrl);
  });

  app.get("/login/callback", async function (req, res) {
    const code = req.query.code;

    try {
      // Exchange authorization code for access token
      const tokenParams = {
        client_id: process.env.discordClientId,
        client_secret: process.env.discordClientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: `${process.env.siteAddress}/login/callback`,
        scope: "identify",
      };

      const tokenResponse = await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: qs.stringify(tokenParams),
        }
      );

      if (!tokenResponse.ok) {
        throw new Error(
          `Failed to obtain access token: ${tokenResponse.status} ${tokenResponse.statusText}`
        );
      }

      const tokenData = await tokenResponse.json();

      // Use the access token to make requests to the Discord API
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error(
          `Failed to fetch user data: ${userResponse.status} ${userResponse.statusText}`
        );
      }

      const userData = await userResponse.json();

      const userGetData = new UserGetter();
      const userIsRegistered = await userGetData.isRegistered(userData.id);

      // 
      // If user is not registered, start the user account verification process.
      // 
      if (!userIsRegistered) {
        const tenSecondsFromNow = new Date(Date.now() + 10000);
        res.setCookie("discordId", userData.id, {
          path: "/",
          httpOnly: true,
          expires: tenSecondsFromNow,
        });

        res.redirect(`/unregistered`);
      } else {
        // 
        // If registered, sign the user into their session. 
        // 
        const userLoginData = await userGetData.byDiscordId(userData.id);
        
        req.session.authenticated = true;
        let userPermissionData = await getUserPermissions(userLoginData);
        let profilePicture = await getProfilePicture(userLoginData.username);

        req.session.user = {
          userId: userLoginData.userId,
          username: userLoginData.username,
          profilePicture: profilePicture,
          discordID: userLoginData.discordID,
          uuid: userLoginData.uuid,
          ranks: userPermissionData.userRanks,
          permissions: userPermissionData,
        };

        setBannerCookie("success", lang.session.userSuccessLogin, res);
        return res.redirect(`${process.env.siteAddress}/`);
      }

      
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/unregistered", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    const discordId = req.cookies.discordId;
    if (!discordId) res.redirect(`/`);

    res.view("session/unregistered", {
      pageTitle: `Unregistered`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      discordId: discordId,
    });

    return res;
  });

  app.get("/logout", async function (req, res) {
    try {
      await req.session.destroy();
      setBannerCookie("success", lang.session.userLogout, res);
      res.redirect(`${process.env.siteAddress}/`);
    } catch (err) {
      console.log(err);
      throw err;
    }
  });
}
