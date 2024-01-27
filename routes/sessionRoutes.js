import bcrypt from "bcrypt";
import fetch from "node-fetch";
import qs from "querystring";
import {
  isFeatureWebRouteEnabled,
  setBannerCookie,
  getGlobalImage,
  generateVerifyCode,
} from "../api/common";
import { getProfilePicture } from "../controllers/userController";
import { getWebAnnouncement } from "../controllers/announcementController";

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
      scope: "identify", // specify required scopes
    };

    const authorizeUrl = `https://discord.com/api/oauth2/authorize?${qs.stringify(
      params
    )}`;

    return res.redirect(authorizeUrl);
  });

  app.get("/login/callback", async function (req, res) {
    const code = req.query.code;

    // Exchange authorization code for access token
    const tokenParams = {
      client_id: process.env.discordClientId, // Use process.env.discordClientId here
      client_secret: process.env.discordClientSecret, // Use process.env.discordClientSecret here
      grant_type: "authorization_code",
      code: code,
      redirect_uri: `${process.env.siteAddress}/callback`, // Use the same redirect URI as in the login route
      scope: "identify",
    };

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: qs.stringify(tokenParams),
    });
    const tokenData = await tokenResponse.json();

    // Use the access token to make requests to the Discord API
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
      },
    });
    const userData = await userResponse.json();

    const tenSecondsFromNow = new Date(Date.now() + 10000); // 10000 milliseconds = 10 seconds
    res.setCookie("discordId", userData.id, {
      path: "/", // Specify the path where the cookie is valid
      httpOnly: true, // Prevent client-side JavaScript from accessing the cookie
      expires: tenSecondsFromNow, // Set the expiration time
    });

    res.redirect(`/unregistered`);
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
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features))
      return;

    const username = req.body.username;
    const password = req.body.password;

    async function getUserRanks(userData, userRanks = null) {
      return new Promise((resolve) => {
        // Call with just userData only get directly assigned Ranks
        if (userRanks === null) {
          db.query(
            `SELECT rankSlug, title FROM userRanks WHERE userId = ?`,
            [userData.userId],
            async function (err, results) {
              if (err) {
                throw err;
              }

              let userRanks = results.map((a) => ({
                ["rankSlug"]: a.rankSlug,
                ["title"]: a.title,
              }));
              resolve(userRanks);
            }
          );
          // Ranks were passed in meaning we are looking for nested ranks
        } else {
          db.query(
            `SELECT rankSlug FROM rankRanks WHERE FIND_IN_SET(parentRankSlug, ?)`,
            [userRanks.join()],
            async function (err, results) {
              if (err) {
                throw err;
              }

              let childRanks = results.map((a) => a.rankSlug);
              let allRanks = userRanks.concat(childRanks);
              //Using a set of the array removes duplicates and prevents infinite loops
              let removeDuplicates = [...new Set(allRanks)];

              //If after removing duplicates the length of the new list is not longer than the old list we are done simply resolve
              if (userRanks.length <= removeDuplicates.length) {
                resolve(removeDuplicates);
              } else {
                resolve(getUserRanks(userData, removeDuplicates));
              }
            }
          );
        }
      });
    }

    async function getRankPermissions(allRanks) {
      return new Promise((resolve) => {
        db.query(
          `SELECT DISTINCT permission FROM rankPermissions WHERE FIND_IN_SET(rankSlug, ?)`,
          [allRanks.join()],
          async function (err, results) {
            if (err) {
              throw err;
            }

            let rankPermissions = results.map((a) => a.permission);
            resolve(rankPermissions);
          }
        );
      });
    }

    async function getUserPermissions(userData) {
      return new Promise((resolve) => {
        //Get permissions assigned directly to user
        db.query(
          `SELECT DISTINCT permission FROM userPermissions WHERE userId = ?`,
          [userData.userId],
          async function (err, results) {
            if (err) {
              throw err;
            }

            let userPermissions = results.map((a) => a.permission);
            resolve(userPermissions);
          }
        );
      });
    }

    db.query(
      `select * from users where username=?`,
      [username],
      async function (err, results) {
        if (err) {
          throw err;
        }

        let hashedPassword = null;

        let loginFailed = false;
        if (!results.length) {
          loginFailed = true;
        } else {
          hashedPassword = results[0].password;
        }

        // User has not logged in before.
        if (loginFailed || hashedPassword == null) {
          let notLoggedInBeforeLang = lang.web.notLoggedInBefore;

          setBannerCookie(
            "warning",
            notLoggedInBeforeLang.replace(
              "%SITEADDRESS%",
              process.env.siteAddress
            ),
            res
          );
          return res.redirect(`${process.env.siteAddress}/login`);
        }

        // Check if passwords match
        const salt = await bcrypt.genSalt();

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
            return res.redirect(`${process.env.siteAddress}/login`);
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
