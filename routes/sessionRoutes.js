import dotenv from "dotenv";
dotenv.config();
import qs from "querystring";
import {
  isFeatureWebRouteEnabled,
  setBannerCookie,
  getGlobalImage,
} from "../api/common";
import { getWebAnnouncement } from "../controllers/announcementController";
import { getProfilePicture, hasJoined } from "../controllers/userController";

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

      const tenSecondsFromNow = new Date(Date.now() + 10000);
      res.setCookie("discordId", userData.id, {
        path: "/",
        httpOnly: true,
        expires: tenSecondsFromNow,
      });

      res.redirect(`/unregistered`);
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

  app.post("/login", async function (req, res) {
    db.query(
      `select * from users where username=?`,
      [username],
      async function (err, results) {
        bcrypt.compare(password, hashedPassword, async function (err, result) {
          if (err) {
            throw err;
          }

          if (result) {
            req.session.authenticated = true;
            let userData = await getPermissions(results[0]);
            let profilePicture = await getProfilePicture(userData.username);

            req.session.user = {
              userId: userData.userId,
              username: userData.username,
              profilePicture: profilePicture,
              discordID: userData.discordID,
              uuid: userData.uuid,
              ranks: userData.userRanks,
              permissions: userData.permissions,
              emailVerified: userData.emailVerified,
              minecraftVerified: userData.minecraftVerified,
            };

            setBannerCookie("success", lang.session.userSuccessLogin, res);
            return res.redirect(`${process.env.siteAddress}/`);
          } else {
            setBannerCookie("warning", lang.session.userFailedLogin, res);
            return res.redirect(`${process.env.siteAddress}/`);
          }
        });
      }
    );

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
