import dotenv from "dotenv";
dotenv.config();
import qs from "querystring";
import {
  isFeatureWebRouteEnabled,
  setBannerCookie,
  getGlobalImage,
} from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";
import {
  UserGetter,
  getProfilePicture,
  getUserPermissions,
} from "../controllers/userController";
import { updateAudit_lastWebsiteLogin } from "../controllers/auditController";

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

    res.redirect(authorizeUrl);
  });

  app.get("/login/callback", async (req, res) => {
    const { code } = req.query;

    try {
      if (!code) {
        throw new Error("Authorization code is missing");
      }

      console.log("Received authorization code:", code);

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
        const errorText = `Failed to obtain access token: ${tokenResponse.status} ${tokenResponse.statusText}`;
        console.error(errorText);
        throw new Error(errorText);
      }

      const tokenData = await tokenResponse.json();
      console.log("Received access token data:", tokenData);

      // Use the access token to fetch user data from Discord API
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        const errorText = `Failed to fetch user data: ${userResponse.status} ${userResponse.statusText}`;
        console.error(errorText);
        throw new Error(errorText);
      }

      const userData = await userResponse.json();
      console.log("Received user data from Discord:", userData);

      // Check if user is registered in your system
      const userGetData = new UserGetter();
      const userIsRegistered = await userGetData.isRegistered(userData.id);

      if (!userIsRegistered) {
        // Set a cookie for unregistered user
        res.cookie("discordId", userData.id, {
          path: "/",
          httpOnly: true,
          maxAge: 10000, // Expires in 10 seconds (for testing purposes)
        });

        console.log("User is unregistered, redirecting to /unregistered");
        return res.redirect(`/unregistered`);
      } else {
        // User is registered, proceed with session setup
        const userLoginData = await userGetData.byDiscordId(userData.id);

        req.session.authenticated = true;
        req.session.user = {
          userId: userLoginData.userId,
          username: userLoginData.username,
          profilePicture: await getProfilePicture(userLoginData.username),
          discordID: userLoginData.discordID,
          uuid: userLoginData.uuid,
          ranks: (await getUserPermissions(userLoginData)).userRanks,
          permissions: await getUserPermissions(userLoginData),
        };

        // Update user profile for auditing
        await updateAudit_lastWebsiteLogin(new Date(), userLoginData.username);

        console.log("User is registered, redirecting to home page");
        return res.redirect(`${process.env.siteAddress}/`);
      }
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).send("Internal Server Error");
    }
  });



  app.get("/unregistered", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    const discordId = req.cookies.discordId;
    if (!discordId) res.redirect(`/`);

    const fetchURL = `${process.env.siteAddress}/api/server/get?type=VERIFICATION`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    console.log(apiData);

    res.view("session/unregistered", {
      pageTitle: `Unregistered`,
      config: config,
      req: req,
      apiData: apiData,
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
