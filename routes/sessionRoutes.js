import bcrypt from "bcrypt";
import {
  isFeatureWebRouteEnabled,
  setBannerCookie,
  getGlobalImage,
} from "../api/common";
import { getProfilePicture } from "../controllers/userController";
import { getWebAnnouncement } from "../controllers/announcementController";
import { generateVerificationCode } from "../controllers/sessionController";
import { sendMail } from "../controllers/emailController";

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

    res.view("session/login", {
      pageTitle: `Login`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });

  app.get("/register", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    res.view("session/register", {
      pageTitle: `Register`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });

  app.get("/verify/email", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;
    
    console.log(await generateVerificationCode());

    sendMail(`benrobson76@gmail.com`, `Testing`);

    res.view("session/verifyEmail", {
      pageTitle: `Verify Email`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });

    return res;
  });

  app.get("/verify/minecraft", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    res.view("session/verifyMinecraft", {
      pageTitle: `Verify Minecraft`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
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
