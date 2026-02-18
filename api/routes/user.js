import fetch from "node-fetch";
import {
  UserGetter,
  UserLinkGetter,
  getProfilePicture,
  getUserLastSession,
  getUserStats,
  setProfileDisplayPreferences,
  setProfileSocialConnections,
  setProfileUserAboutMe,
  setProfileUserInterests,
} from "../../controllers/userController.js";
import {
  required,
  optional,
  generateVerifyCode,
  setBannerCookie,
} from "../common.js";
import { hasActiveWebBan } from "../../controllers/discordPunishmentController.js";

export default function userApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/user";

  app.post(baseEndpoint + "/create", async function (req, res) {
    const uuid = required(req.body, "uuid", res);
    const username = required(req.body, "username", res);

    const userCreatedLang = lang.api.userCreated;
    const userAlreadyExistsLang = lang.api.userAlreadyExists;

    try {
      // Check if the user exists
      const existingUser = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM users WHERE uuid=?`,
          [uuid],
          function (error, results, fields) {
            if (error) {
              reject(error);
            }
            resolve(results[0]);
          }
        );
      });

      if (existingUser) {
        // User already exists, update the username
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE users SET username=? WHERE uuid=?;`,
            [username, uuid],
            function (error, results, fields) {
              if (error) {
                reject(error);
              }
              resolve();
            }
          );
        });

        return res.send({
          success: null,
          message: userAlreadyExistsLang,
        });
      } else {
        // User does not exist, create them
        await new Promise((resolve, reject) => {
          db.query(
            `INSERT INTO users (uuid, username) VALUES (?, ?)`,
            [uuid, username],
            function (error, results, fields) {
              if (error) {
                reject(error);
              }
              resolve();
            }
          );
        });

        return res.send({
          success: true,
          message: userCreatedLang
            .replace("%USERNAME%", username)
            .replace("%UUID%", uuid),
        });
      }
    } catch (error) {
      console.log(error);
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  // TODO: Update docs
  app.get(baseEndpoint + "/get", async function (req, res) {
    const username = optional(req.query, "username");
    const discordId = optional(req.query, "discordId");
    const userId = optional(req.query, "userId");

    try {
      if (username) {
        db.query(
          `SELECT * FROM users WHERE username=?;`,
          [username],
          function (error, results, fields) {
            if (error) {
              return res.send({
                success: false,
                message: error,
              });
            }

            if (!results || !results.length) {
              return res.send({
                success: false,
                message: lang.api.userDoesNotExist,
              });
            }

            return res.send({
              success: true,
              data: results,
            });
          }
        );
      } else if (discordId) {
        db.query(
          `SELECT * FROM users WHERE discordId=?;`,
          [discordId],
          function (error, results, fields) {
            if (error) {
              return res.send({
                success: false,
                message: error,
              });
            }

            if (!results || !results.length) {
              return res.send({
                success: false,
                message: lang.api.userDoesNotExist,
              });
            }

            return res.send({
              success: true,
              data: results,
            });
          }
        );
      } else if (userId) {
        db.query(
          `SELECT * FROM users WHERE userId=?;`,
          [userId],
          function (error, results, fields) {
            if (error) {
              return res.send({
                success: false,
                message: error,
              });
            }

            if (!results || !results.length) {
              return res.send({
                success: false,
                message: lang.api.userDoesNotExist,
              });
            }

            return res.send({
              success: true,
              data: results,
            });
          }
        );
      } else {
        db.query(`SELECT * FROM users;`, function (error, results, fields) {
          if (error) {
            return res.send({
              success: false,
              message: error,
            });
          }

          if (!results || !results.length) {
            return res.send({
              success: false,
              message: `No Users found`,
            });
          }

          return res.send({
            success: true,
            data: results,
          });
        });
      }
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  // TODO: Update docs
  app.get(baseEndpoint + "/profile/get", async function (req, res) {
    const username = optional(req.query, "username");
    const discordId = optional(req.query, "discordId");

    try {
      const buildProfileResponse = async (userRecord) => {
        if (!userRecord) {
          return res.send({
            success: false,
            message: lang.api.userDoesNotExist,
          });
        }

        const profilePicture = await getProfilePicture(userRecord.username);
        const profileStats = await getUserStats(userRecord.userId);
        const profileSession = await getUserLastSession(userRecord.userId);

        return res.send({
          success: true,
          data: {
            profileData: userRecord,
            profilePicture: profilePicture,
            profileStats: profileStats,
            profileSession: profileSession,
          },
        });
      };

      if (username) {
        //
        // Grab user data
        //
        const fetchURL = `${process.env.siteAddress}/api/user/get?username=${username}`;
        const response = await fetch(fetchURL, {
          headers: { "x-access-token": process.env.apiKey },
        });

        const apiData = await response.json();

        if (!apiData.success || !apiData.data || !apiData.data.length) {
          return res.send({
            success: false,
            message: lang.api.userDoesNotExist,
          });
        }

        return await buildProfileResponse(apiData.data[0]);
      } else if (discordId) {
        const fetchURL = `${process.env.siteAddress}/api/user/get?discordId=${discordId}`;
        const response = await fetch(fetchURL, {
          headers: { "x-access-token": process.env.apiKey },
        });

        const apiData = await response.json();

        if (!apiData.success || !apiData.data || !apiData.data.length) {
          return res.send({
            success: false,
            message: lang.api.userDoesNotExist,
          });
        }

        return await buildProfileResponse(apiData.data[0]);
      } else {
        return res.send({
          success: false,
          message: `No Users found`,
        });
      }
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.get(baseEndpoint + "/punishments", async function (req, res) {
    const uuid = optional(req.query, "uuid");
    const username = optional(req.query, "username");
    const discordId = optional(req.query, "discordId");

    try {
      const userGetter = new UserGetter();
      let userRecord = null;
      let resolvedUuid = uuid;

      if (resolvedUuid) {
        userRecord = await userGetter.byUUID(resolvedUuid);
      } else if (username) {
        userRecord = await userGetter.byUsername(username);
      } else if (discordId) {
        userRecord = await userGetter.byDiscordId(discordId);
      }

      if (!resolvedUuid && userRecord?.uuid) {
        resolvedUuid = userRecord.uuid;
      }

      if (!resolvedUuid) {
        return res.send({
          success: false,
          message: lang.api.userDoesNotExist,
        });
      }

      const punishments = await new Promise((resolve, reject) => {
        db.query(
          `SELECT p.*, banner.username AS bannedByUsername, remover.username AS removedByUsername
           FROM punishments p
           LEFT JOIN users banner ON p.bannedByUserId = banner.userId
           LEFT JOIN users remover ON p.removedByUserId = remover.userId
           WHERE p.bannedUuid = ?
           ORDER BY p.dateStart DESC
           LIMIT 50`,
          [resolvedUuid],
          (error, results) => {
            if (error) {
              return reject(error);
            }

            resolve(results || []);
          }
        );
      });

      return res.send({
        success: true,
        data: punishments,
        target: {
          username: userRecord?.username ?? null,
          uuid: resolvedUuid,
          userId: userRecord?.userId ?? null,
        },
      });
    } catch (error) {
      console.error("Failed to fetch punishments", error);
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  app.post(baseEndpoint + "/verify", async function (req, res) {
    const username = required(req.body, "username");
    const uuid = required(req.body, "uuid");

    const userData = new UserGetter();
    const user = await userData.byUUID(uuid);

    if (!user) {
      return res.send({
        success: false,
        message: `User ${username} does not exist in player base, please join the Network and try again.`,
      });
    } else {
      if (user.discordId) {
        return res.send({
          success: false,
          message: `You are already registered and linked, you cannot do this again.`,
        });
      }

      try {
        const linkCode = await generateVerifyCode();
        const now = new Date();
        const codeExpiry = new Date(now.getTime() + 5 * 60000);

        db.query(
          `INSERT INTO userVerifyLink (uuid, username, linkCode, codeExpiry) VALUES (?, ?, ?, ?)`,
          [uuid, username, linkCode, codeExpiry],
          function (error, results, fields) {
            if (error) {
              return res.send({
                success: false,
                message: `There was an error in setting your code, try again in 5 minutes.`,
              });
            }

            return res.send({
              success: true,
              message: `Here is your code: ${linkCode}\nGo back to the registration form and put this in.\nThis code will expire in 5 minutes.`,
            });
          }
        );
      } catch (error) {
        return res.send({
          success: false,
          message: `${error}`,
        });
      }
    }

    return res;
  });

  app.post(baseEndpoint + "/link", async function (req, res) {
    const discordId = required(req.body, "discordId");
    const first = required(req.body, "first");
    const second = required(req.body, "second");
    const third = required(req.body, "third");
    const fourth = required(req.body, "fourth");
    const fifth = required(req.body, "fifth");
    const sixth = required(req.body, "sixth");

    const verifyCode = first + second + third + fourth + fifth + sixth;

    try {
      //
      // Grab link code and find player.
      //
      const userLinkData = new UserLinkGetter();
      const linkUser = await userLinkData.getUserByCode(verifyCode);
      let linkUserUUID = linkUser.uuid;

      if (!linkUser) {
        setBannerCookie(
          "warning",
          `No verification code matches, please try again.`,
          res
        );
        return res.redirect(`/unregistered`);
      }

      //
      // Bind Discord Account to User ID
      //
      userLinkData
        .link(linkUserUUID, discordId)
        .then((success) => {
          if (success) {
            console.error("Linking success");
            setBannerCookie("success", `Link success`, res);
          } else {
            // Handle error or do something else
            setBannerCookie("warning", `Link failed`, res);
          }
        })
        .catch((error) => {
          // Handle error
          console.error("Error linking");
          setBannerCookie(
            "warning",
            `Issue with linking, try again soon.`,
            res
          );
        });
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/profile/display", async function (req, res) {
    const userId = required(req.body, "userId");
    const profilePicture_type = required(req.body, "profilePicture_type");
    const profilePicture_email = optional(req.body, "profilePicture_email");

    if (await hasActiveWebBan(req.session?.user?.userId)) {
      return res.send({ success: false, message: "You are currently banned from editing your profile." });
    }

    try {
      setProfileDisplayPreferences(
        userId,
        profilePicture_type,
        profilePicture_email
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });

  app.post(baseEndpoint + "/profile/interests", async function (req, res) {
    const userId = required(req.body, "userId");
    const social_interests = required(req.body, "social_interests");

    if (await hasActiveWebBan(req.session?.user?.userId)) {
      return res.send({ success: false, message: "You are currently banned from editing your profile." });
    }

    try {
      const filterURL = `${process.env.siteAddress}/api/filter`;
      const bodyJSON = { content: social_interests };

      const response = await fetch(filterURL, {
        method: "POST",
        body: JSON.stringify(bodyJSON),
        headers: {
          "Content-Type": "application/json",
          "x-access-token": process.env.apiKey,
        },
      });

      const dataResponse = await response.json();
      console.log(dataResponse);

      if (dataResponse.success == true) {
        try {
          setProfileUserInterests(userId, social_interests);
        } catch (error) {
          return res.send({
            success: false,
            message: `${error}`,
          });
        }
      } else {
        console.log(`Illegal words detected.`);
        setBannerCookie(
          "danger",
          `Illegal words detected, changes not applied.`,
          res
        );
      }
    } catch (error) {
      console.log(error);
      return;
    }

    return res;
  });

  app.post(baseEndpoint + "/profile/about", async function (req, res) {
    const userId = required(req.body, "userId");
    const social_aboutMe = required(req.body, "social_aboutMe");

    if (await hasActiveWebBan(req.session?.user?.userId)) {
      return res.send({ success: false, message: "You are currently banned from editing your profile." });
    }

    try {
      const filterURL = `${process.env.siteAddress}/api/filter`;
      const bodyJSON = { content: social_aboutMe };

      const response = await fetch(filterURL, {
        method: "POST",
        body: JSON.stringify(bodyJSON),
        headers: {
          "Content-Type": "application/json",
          "x-access-token": process.env.apiKey,
        },
      });

      const dataResponse = await response.json();
      console.log(dataResponse);

      if (dataResponse.success == true) {
        try {
          setProfileUserAboutMe(userId, social_aboutMe);
        } catch (error) {
          return res.send({
            success: false,
            message: `${error}`,
          });
        }
      }
    } catch (error) {
      console.log(error);
      return;
    }

    return res;
  });

  app.post(baseEndpoint + "/profile/social", async function (req, res) {
    const userId = required(req.body, "userId");
    const social_discord = optional(req.body, "social_discord");
    const social_steam = optional(req.body, "social_steam");
    const social_twitch = optional(req.body, "social_twitch");
    const social_youtube = optional(req.body, "social_youtube");
    const social_twitter_x = optional(req.body, "social_twitter_x");
    const social_instagram = optional(req.body, "social_instagram");
    const social_reddit = optional(req.body, "social_reddit");
    const social_spotify = optional(req.body, "social_spotify");

    if (await hasActiveWebBan(req.session?.user?.userId)) {
      return res.send({ success: false, message: "You are currently banned from editing your profile." });
    }

    try {
      setProfileSocialConnections(
        userId,
        social_discord,
        social_steam,
        social_twitch,
        social_youtube,
        social_twitter_x,
        social_instagram,
        social_reddit,
        social_spotify
      );
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }

    return res;
  });
}
