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
import { getTicketsAccessibleByUser } from "../controllers/supportTicketController.js";
import {
  getUserByUsername,
  getUserRanks,
  getReportsByReporterId,
  getUserPunishments,
} from "../services/profileService.js";
import {
  getDiscordPunishmentsForProfile,
  hasActiveWebBan,
} from "../controllers/discordPunishmentController.js";

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
        { await res.view("session/notFound", {
          pageTitle: `404: Player Not Found`,
          config: config,
          req: req,
          res: res,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        }); return; }
      } else {
        //
        // Grab user profile data (direct DB query, no HTTP self-call)
        //
        const profileData = await getUserByUsername(username);
        if (!profileData) {
          { await res.view("session/notFound", {
            pageTitle: `404: Player Not Found`,
            config: config,
            req: req,
            res: res,
            features: features,
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
          }); return; }
        }

        //
        // Grab user reports (direct DB query, no HTTP self-call)
        //
        const profileReportsApiData = await getReportsByReporterId(profileData.userId);

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
        // Grab user punishments (direct DB query, no HTTP self-call)
        //
        let profilePunishmentsApiData = { success: true, data: [] };
        let discordPunishmentsData = [];
        const isViewingOwnProfile =
          req.session.user && req.session.user.username === username;
        if (
          isViewingOwnProfile ||
          (contextPermissions &&
            contextPermissions.includes("zander.web.punishments"))
        ) {
          profilePunishmentsApiData = await getUserPunishments(username);

          // Also fetch Discord punishments for this user
          try {
            discordPunishmentsData = await getDiscordPunishmentsForProfile({
              discordUserId: profileData.discordId || null,
              playerId: profileData.userId || null,
            });
          } catch (err) {
            console.error("[PROFILE] Failed to fetch Discord punishments:", err);
          }
        }

        const canAppeal = isViewingOwnProfile;
        let appealTicketsByKey = {};
        if (canAppeal) {
          const userRankSlugs =
            req.session.user.ranks?.map((rank) => rank.rankSlug) || [];
          const tickets = await getTicketsAccessibleByUser(
            req.session.user.userId,
            userRankSlugs
          );
          appealTicketsByKey = (tickets || []).reduce((acc, ticket) => {
            if (ticket.status === "closed") {
              return acc;
            }
            const match = String(ticket.title || "").match(/Appeal #([^\s]+)/);
            if (match && match[1]) {
              acc[match[1]] = ticket.ticketId;
            }
            return acc;
          }, {});
        }

        //
        // Render the profile page
        //
        { await res.view("modules/profile/profile", {
          pageTitle: `${profileData.username}`,
          config: config,
          req: req,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
          profilePicture: await getProfilePicture(profileData.username),
          profileApiData: profileData,
          profileRanks: await getUserRanks(profileData.username),
          profileReportsApiData: profileReportsApiData,
          profilePunishmentsApiData: profilePunishmentsApiData,
          discordPunishmentsData: discordPunishmentsData,
          appealTicketsByKey: appealTicketsByKey,
          canAppeal: canAppeal,
          profileStats: await getUserStats(profileData.userId),
          profileSession: await getUserLastSession(profileData.userId),
          moment: moment,
          contextPermissions: contextPermissions,
        }); return; }
      }
    } catch (error) {
      console.error("[PROFILE] Failed to load profile", error);

      { await res.status(500).view("session/error", {
        pageTitle: `Server Error`,
        config: config,
        error: error,
        req: req,
        features: features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      }); return; }
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

      if (!isLoggedIn(req)) { res.redirect(`/`); return; }

      // Check if user is web-banned
      const sessionUserId = req.session?.user?.userId;
      if (sessionUserId && await hasActiveWebBan(sessionUserId)) {
        await setBannerCookie("danger", "You are currently banned from editing your profile.", res);
        { res.redirect(`/profile/${username}`); return; }
      }

      if (!userHasJoined) {
        { await res.view("session/notFound", {
          pageTitle: `404: Player Not Found`,
          config: config,
          req: req,
          res: res,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
        }); return; }
      } else {
        //
        // Grab user profile data (direct DB query, no HTTP self-call)
        //
        const profileData = await getUserByUsername(req.session.user.username);
        if (!profileData) {
          { await res.view("session/notFound", {
            pageTitle: `404: Player Not Found`,
            config: config,
            req: req,
            res: res,
            features: features,
            globalImage: await getGlobalImage(),
            announcementWeb: await getWebAnnouncement(),
          }); return; }
        }

        //
        // Render the profile page
        //
        { await res.view("modules/profile/profileEditor", {
          pageTitle: `${profileData.username} - Profile Editor`,
          config: config,
          req: req,
          features: features,
          globalImage: await getGlobalImage(),
          announcementWeb: await getWebAnnouncement(),
          profilePicture: await getProfilePicture(profileData.username),
          profileApiData: profileData,
          profileRanks: await getUserRanks(profileData.username),
          profileStats: await getUserStats(profileData.userId),
          profileSession: await getUserLastSession(profileData.userId),
          moment: moment,
        }); return; }
      }
    } catch (error) {
      console.error("[PROFILE] Failed to load profile editor", error);

      { await res.status(500).view("session/error", {
        pageTitle: `Server Error`,
        config: config,
        error: error,
        req: req,
        features: features,
        globalImage: await getGlobalImage(),
        announcementWeb: await getWebAnnouncement(),
      }); return; }
    }
  });

  app.get("/profile/social/discord/connect", async function (req, res) {
    if (!isLoggedIn(req)) {
      setBannerCookie(
        "warning",
        "You need to sign in to connect a Discord account.",
        res
      );
      { res.redirect(`/login`); return; }
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

    { res.redirect(buildDiscordLinkAuthorizeUrl(state)); return; }
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
      { res.redirect(`/login`); return; }
    }

    if (!req.query.code) {
      setBannerCookie(
        "danger",
        "Discord did not send an authorisation code.",
        res
      );
      { res.redirect(redirectPath); return; }
    }

    if (!linkSession.state || linkSession.state !== req.query.state) {
      setBannerCookie(
        "danger",
        "Discord connection expired, please try again.",
        res
      );
      { res.redirect(redirectPath); return; }
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
        { res.redirect(redirectPath); return; }
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

    { res.redirect(redirectPath); return; }
  });

  app.post("/profile/social/discord/disconnect", async function (req, res) {
    if (!isLoggedIn(req)) {
      setBannerCookie(
        "warning",
        "You need to sign in to disconnect Discord.",
        res
      );
      { res.redirect(`/login`); return; }
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

    { res.redirect(getProfileEditorRedirect(req)); return; }
  });
}
