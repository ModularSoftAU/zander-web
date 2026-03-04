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
import { required, optional, generateVerifyCode } from "../common.js";
import { hasActiveWebBan } from "../../controllers/discordPunishmentController.js";

export default function userApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/user";

  app.post(baseEndpoint + "/create", async function (req, res) {
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const username = required(req.body, "username", res);
    if (res.sent) return;

    const userCreatedLang = lang.api.userCreated;
    const userAlreadyExistsLang = lang.api.userAlreadyExists;

    try {
      // Check if the user exists
      const existingUser = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM users WHERE uuid=?`,
          [uuid],
          function (error, results) {
            if (error) return reject(error);
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
            function (error, results) {
              if (error) return reject(error);
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
            function (error, results) {
              if (error) return reject(error);
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
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  // TODO: Update docs
  app.get(baseEndpoint + "/get", async function (req, res) {
    const username = optional(req.query, "username");
    const discordId = optional(req.query, "discordId");
    const userId = optional(req.query, "userId");

    try {
      let dbQuery;
      let params = [];

      if (username) {
        dbQuery = "SELECT * FROM users WHERE username=?";
        params = [username];
      } else if (discordId) {
        dbQuery = "SELECT * FROM users WHERE discordId=?";
        params = [discordId];
      } else if (userId) {
        dbQuery = "SELECT * FROM users WHERE userId=?";
        params = [userId];
      } else {
        dbQuery = "SELECT * FROM users";
      }

      const results = await new Promise((resolve, reject) => {
        db.query(dbQuery, params, (error, results) => {
          if (error) return reject(error);
          resolve(results);
        });
      });

      if (!results || !results.length) {
        return res.send({
          success: false,
          message: lang.api.userDoesNotExist || "No Users found",
        });
      }

      return res.send({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
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
        const fetchURL = `${process.env.siteAddress}/api/user/get?username=${encodeURIComponent(username)}`;
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
        const fetchURL = `${process.env.siteAddress}/api/user/get?discordId=${encodeURIComponent(discordId)}`;
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
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
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
            if (error) return reject(error);
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
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(
    baseEndpoint + "/verify",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    async function (req, res) {
    const username = required(req.body, "username", res);
    if (res.sent) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;

    try {
      const userData = new UserGetter();
      const user = await userData.byUUID(uuid);

      if (!user) {
        return res.send({
          success: false,
          message: `User ${username} does not exist in player base, please join the Network and try again.`,
        });
      }

      if (user.discordId) {
        return res.send({
          success: false,
          message: `You are already registered and linked, you cannot do this again.`,
        });
      }

      const linkCode = await generateVerifyCode();
      const now = new Date();
      const codeExpiry = new Date(now.getTime() + 5 * 60000);

      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO userVerifyLink (uuid, username, linkCode, codeExpiry) VALUES (?, ?, ?, ?)`,
          [uuid, username, linkCode, codeExpiry],
          function (error, results) {
            if (error) return reject(error);
            resolve(results);
          }
        );
      });

      return res.send({
        success: true,
        message: `Here is your code: ${linkCode}\nGo back to the registration form and put this in.\nThis code will expire in 5 minutes.`,
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `There was an error in setting your code, try again in 5 minutes.`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/link", async function (req, res) {
    const discordId = required(req.body, "discordId", res);
    if (res.sent) return;
    const first = required(req.body, "first", res);
    if (res.sent) return;
    const second = required(req.body, "second", res);
    if (res.sent) return;
    const third = required(req.body, "third", res);
    if (res.sent) return;
    const fourth = required(req.body, "fourth", res);
    if (res.sent) return;
    const fifth = required(req.body, "fifth", res);
    if (res.sent) return;
    const sixth = required(req.body, "sixth", res);
    if (res.sent) return;

    const verifyCode = first + second + third + fourth + fifth + sixth;

    try {
      const userLinkData = new UserLinkGetter();
      const linkUser = await userLinkData.getUserByCode(verifyCode);

      if (!linkUser) {
        return res.send({
          success: false,
          alertType: "warning",
          alertContent: `No verification code matches, please try again.`,
        });
      }

      let linkUserUUID = linkUser.uuid;

      try {
        const success = await userLinkData.link(linkUserUUID, discordId);
        if (success) {
          return res.send({
            success: true,
            alertType: "success",
            alertContent: `Link success`,
          });
        } else {
          return res.send({
            success: false,
            alertType: "warning",
            alertContent: `Link failed`,
          });
        }
      } catch (error) {
        console.error("Error linking:", error);
        return res.send({
          success: false,
          alertType: "warning",
          alertContent: `Issue with linking, try again soon.`,
        });
      }
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/profile/display", async function (req, res) {
    const userId = required(req.body, "userId", res);
    if (res.sent) return;
    const profilePicture_type = required(req.body, "profilePicture_type", res);
    if (res.sent) return;
    const profilePicture_email = optional(req.body, "profilePicture_email");

    if (await hasActiveWebBan(req.session?.user?.userId)) {
      return res.send({ success: false, message: "You are currently banned from editing your profile." });
    }

    try {
      await setProfileDisplayPreferences(
        userId,
        profilePicture_type,
        profilePicture_email,
      );
      return res.send({ success: true, message: "Display preferences updated." });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/profile/interests", async function (req, res) {
    const userId = required(req.body, "userId", res);
    if (res.sent) return;
    const social_interests = required(req.body, "social_interests", res);
    if (res.sent) return;

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

      if (dataResponse.success === true) {
        try {
          await setProfileUserInterests(userId, social_interests);
          return res.send({ success: true, message: "Interests updated." });
        } catch (error) {
          console.error(error);
          return res.status(500).send({
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
        return res.send({ success: false, message: "Illegal words detected." });
      }
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/profile/about", async function (req, res) {
    const userId = required(req.body, "userId", res);
    if (res.sent) return;
    const social_aboutMe = required(req.body, "social_aboutMe", res);
    if (res.sent) return;

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

      if (dataResponse.success === true) {
        try {
          await setProfileUserAboutMe(userId, social_aboutMe);
          return res.send({ success: true, message: "About me updated." });
        } catch (error) {
          console.error(error);
          return res.status(500).send({
            success: false,
            message: `${error}`,
          });
        }
      } else {
        return res.send({ success: false, message: "Illegal words detected." });
      }
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });

  app.post(baseEndpoint + "/profile/social", async function (req, res) {
    const userId = required(req.body, "userId", res);
    if (res.sent) return;
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
      await setProfileSocialConnections(
        userId,
        social_discord,
        social_steam,
        social_twitch,
        social_youtube,
        social_twitter_x,
        social_instagram,
        social_reddit,
        social_spotify,
      );
      return res.send({ success: true, message: "Social connections updated." });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({
          success: false,
          message: `${error}`,
        });
      }
    }
  });
}
