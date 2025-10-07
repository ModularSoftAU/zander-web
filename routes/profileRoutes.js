import crypto from "crypto";
import qs from "querystring";
import { getGlobalImage, isLoggedIn, setBannerCookie } from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import {
  UserGetter,
  getProfilePicture,
  getUserLastSession,
  getUserPermissions,
  getUserStats,
  linkDiscordAccount,
  unlinkDiscordAccount,
} from "../controllers/userController.js";

export default function profileSiteRoutes(
  app,
  client,
  fetch,
  moment,
  config,
  db,
  features,
  lang
) {
  const buildDiscordLinkAuthorizeUrl = (state) => {
    const params = {
      client_id: process.env.discordClientId,
      redirect_uri: `${process.env.siteAddress}/profile/social/discord/callback`,
      response_type: "code",
      scope: "identify",
      state,
    };

    return `https://discord.com/api/oauth2/authorize?${qs.stringify(params)}`;
  };

  const getProfileEditorRedirect = (req) => {
    const username = req.session?.user?.username;
    return username ? `/profile/${username}/edit` : `/profile`;
  };

  const buildDiscordDisplayName = (discordUser) => {
    if (!discordUser) {
      return null;
    }

    const discriminator =
      discordUser.discriminator && discordUser.discriminator !== "0"
        ? `#${discordUser.discriminator}`
        : "";

    const baseName = discordUser.global_name
      ? discordUser.global_name
      : discriminator
      ? `${discordUser.username}${discriminator}`
      : `@${discordUser.username}`;

    return baseName.substring(0, 32);
  };

  //
  // View User Profile
  //
  app.get("/profile/:username", async function (req, res) {
    const username = req.params.username;

    try {
      const userData = new UserGetter();
      const userHasJoined = await userData.hasJoined(username);

      if (!userHasJoined) {
        return res.view("session/notFound", {
          pageTitle: `404: Player Not Found`,
          config: config,
          req: req,
          res: res,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      } else {
        //
        // Grab user profile data
        //
        const fetchURL = `${process.env.siteAddress}/api/user/get?username=${username}`;
        const response = await fetch(fetchURL, {
          headers: { "x-access-token": process.env.apiKey },
        });
        const profileApiData = await response.json();

        //
        // Grab user reports
        //
        const fetchReportsURL = `${process.env.siteAddress}/api/report/get?reporterId=${profileApiData.data[0].userId}`;
        const reportsResponse = await fetch(fetchReportsURL, {
          headers: { "x-access-token": process.env.apiKey },
        });
        const profileReportsApiData = await reportsResponse.json();

        //
        // Get user context for display permissions
        //
        let contextPermissions = null;

        if (req.session.user) {
          const userProfile = await userData.byUsername(
            req.session.user.username
          );
          const perms = await getUserPermissions(userProfile);
          contextPermissions = perms;
        } else {
          contextPermissions = null;
        }

        //
        // Render the profile page
        //
        return res.view("modules/profile/profile", {
          pageTitle: `${profileApiData.data[0].username}`,
          config: config,
          req: req,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
          profilePicture: await getProfilePicture(
            profileApiData.data[0].username
          ),
          profileApiData: profileApiData.data[0],
          profileReportsApiData: profileReportsApiData,
          profileStats: await getUserStats(profileApiData.data[0].userId),
          profileSession: await getUserLastSession(
            profileApiData.data[0].userId
          ),
          moment: moment,
          contextPermissions: contextPermissions,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });


  //
  // Edit Signed in User profile
  //
  app.get("/profile/:username/edit", async function (req, res) {
    const username = req.params.username;

    try {
      const userData = new UserGetter();
      const userHasJoined = await userData.hasJoined(username);

      if (!isLoggedIn(req)) return res.redirect(`/`);

      if (!userHasJoined) {
        return res.view("session/notFound", {
          pageTitle: `404: Player Not Found`,
          config: config,
          req: req,
          res: res,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        });
      } else {
        //
        // Grab user profile data
        //
        const fetchURL = `${process.env.siteAddress}/api/user/get?username=${req.session.user.username}`;
        const response = await fetch(fetchURL, {
          headers: { "x-access-token": process.env.apiKey },
        });

        const profileApiData = await response.json();

        //
        // Render the profile page
        //
        return res.view("modules/profile/profileEditor", {
          pageTitle: `${profileApiData.data[0].username} - Profile Editor`,
          config: config,
          req: req,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
          profilePicture: await getProfilePicture(profileApiData.data[0].username),
          profileApiData: profileApiData.data[0],
          profileStats: await getUserStats(profileApiData.data[0].userId),
          profileSession: await getUserLastSession(profileApiData.data[0].userId),
          moment: moment,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.get("/profile/social/discord/connect", async function (req, res) {
    if (!isLoggedIn(req)) {
      setBannerCookie(
        "warning",
        "You need to sign in to connect a Discord account.",
        res
      );
      return res.redirect(`/login`);
    }

    const state = crypto.randomBytes(16).toString("hex");
    const requestedRedirect =
      typeof req.query.redirect === "string" && req.query.redirect.startsWith("/")
        ? req.query.redirect
        : getProfileEditorRedirect(req);

    req.session.discordLink = {
      state,
      redirect: requestedRedirect,
    };

    return res.redirect(buildDiscordLinkAuthorizeUrl(state));
  });

  app.get("/profile/social/discord/callback", async function (req, res) {
    const linkSession = req.session.discordLink || {};
    delete req.session.discordLink;

    const redirectPath = linkSession.redirect || getProfileEditorRedirect(req);

    if (!isLoggedIn(req)) {
      setBannerCookie(
        "warning",
        "Please sign in again to complete Discord linking.",
        res
      );
      return res.redirect(`/login`);
    }

    if (!req.query.code) {
      setBannerCookie(
        "danger",
        "Discord did not send an authorisation code.",
        res
      );
      return res.redirect(redirectPath);
    }

    if (!linkSession.state || linkSession.state !== req.query.state) {
      setBannerCookie(
        "danger",
        "Discord connection expired, please try again.",
        res
      );
      return res.redirect(redirectPath);
    }

    try {
      const tokenParams = {
        client_id: process.env.discordClientId,
        client_secret: process.env.discordClientSecret,
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: `${process.env.siteAddress}/profile/social/discord/callback`,
      };

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: qs.stringify(tokenParams),
      });

      if (!tokenResponse.ok) {
        throw new Error(
          `Failed to obtain Discord token (${tokenResponse.status} ${tokenResponse.statusText})`
        );
      }

      const tokenData = await tokenResponse.json();

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error(
          `Failed to fetch Discord profile (${userResponse.status} ${userResponse.statusText})`
        );
      }

      const discordUser = await userResponse.json();
      const userData = new UserGetter();
      const existingLink = await userData.byDiscordId(discordUser.id);

      if (existingLink && existingLink.userId !== req.session.user.userId) {
        setBannerCookie(
          "danger",
          "That Discord account is already linked to another profile.",
          res
        );
        return res.redirect(redirectPath);
      }

      await linkDiscordAccount(
        req.session.user.userId,
        discordUser.id,
        buildDiscordDisplayName(discordUser)
      );

      req.session.user.discordID = discordUser.id;

      setBannerCookie("success", "Discord account connected!", res);
    } catch (error) {
      console.error("[PROFILE] Discord link failed", error);
      setBannerCookie(
        "danger",
        "We couldn't connect your Discord account. Please try again soon.",
        res
      );
    }

    return res.redirect(redirectPath);
  });

  app.post("/profile/social/discord/disconnect", async function (req, res) {
    if (!isLoggedIn(req)) {
      setBannerCookie(
        "warning",
        "You need to sign in to disconnect Discord.",
        res
      );
      return res.redirect(`/login`);
    }

    try {
      await unlinkDiscordAccount(req.session.user.userId);
      req.session.user.discordID = null;
      setBannerCookie("success", "Discord account disconnected.", res);
    } catch (error) {
      console.error("[PROFILE] Discord unlink failed", error);
      setBannerCookie(
        "danger",
        "We couldn't disconnect your Discord account. Please try again soon.",
        res
      );
    }

    return res.redirect(getProfileEditorRedirect(req));
  });
}
