import dotenv from "dotenv";
dotenv.config();
import qs from "querystring";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  isFeatureWebRouteEnabled,
  setBannerCookie,
  getGlobalImage,
} from "../api/common.js";
import { getWebAnnouncement } from "../controllers/announcementController.js";
import {
  UserGetter,
  getProfilePicture,
  getUserPermissions,
  getUserRanks,
  updateUserCredentials,
  markEmailVerified,
  clearEmailVerificationToken,
  savePasswordResetToken,
  clearPasswordResetToken,
  updatePassword,
  updateEmail,
  linkDiscordAccount,
} from "../controllers/userController.js";
import { updateAudit_lastWebsiteLogin } from "../controllers/auditController.js";
import {
  sendEmailVerificationMail,
  sendPasswordResetMail,
} from "../controllers/emailController.js";

const EMAIL_TOKEN_EXPIRY_MINUTES = 60;
const PASSWORD_TOKEN_EXPIRY_MINUTES = 30;

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : "";
}

function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

function tokenExpiry(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function buildSession(req, user) {
  const userPermissionData = await getUserPermissions(user);
  const userRanks = await getUserRanks(user);
  req.session.authenticated = true;
  req.session.user = {
    userId: user.userId,
    username: user.username,
    profilePicture: await getProfilePicture(user.username),
    discordID: user.discordId,
    uuid: user.uuid,
    ranks: userRanks,
    permissions: userPermissionData,
    email: user.email,
  };
  await updateAudit_lastWebsiteLogin(new Date(), user.username);
}

function createDiscordState(req, action) {
  const csrf = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = csrf;
  const payload = { action, csrf };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function parseDiscordState(req, stateParam) {
  if (!stateParam) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(stateParam, "base64url").toString("utf-8")
    );
    if (!decoded?.csrf || decoded.csrf !== req.session.oauthState) {
      return null;
    }
    delete req.session.oauthState;
    return decoded;
  } catch (error) {
    return null;
  }
}

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
  // Email/password authentication
  //
  app.get("/login", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    if (req.query?.provider === "discord" || req.query?.discord === "1") {
      return res.redirect(`/login/discord`);
    }

    return res.view("session/login", {
      pageTitle: `Login`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/login", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    const email = normalizeEmail(req.body?.email || "");
    const password = req.body?.password?.trim();

    if (!email || !password) {
      await setBannerCookie("warning", "Please provide both email and password.", res);
      return res.redirect(`/login`);
    }

    try {
      const userGetter = new UserGetter();
      const user = await userGetter.byEmail(email);

      if (!user || !user.password_hash) {
        await setBannerCookie("danger", "The provided credentials were invalid.", res);
        return res.redirect(`/login`);
      }

      if (!user.email_verified) {
        await setBannerCookie(
          "warning",
          "You need to verify your email address before signing in.",
          res
        );
        return res.redirect(`/login`);
      }

      const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!passwordMatches) {
        await setBannerCookie("danger", "The provided credentials were invalid.", res);
        return res.redirect(`/login`);
      }

      await buildSession(req, user);
      return res.redirect(`${process.env.siteAddress}/`);
    } catch (error) {
      console.error("Login error", error);
      await setBannerCookie("danger", "We were unable to log you in right now.", res);
      return res.redirect(`/login`);
    }
  });

  app.get("/register", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    return res.view("session/register", {
      pageTitle: `Register`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/register", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    const username = req.body?.username?.trim();
    const email = normalizeEmail(req.body?.email || "");
    const password = req.body?.password?.trim();
    const confirmPassword = req.body?.confirmPassword?.trim();

    if (!username || !email || !password || !confirmPassword) {
      await setBannerCookie("warning", "All fields are required.", res);
      return res.redirect(`/register`);
    }

    if (password.length < 8) {
      await setBannerCookie(
        "warning",
        "Password must be at least 8 characters long.",
        res
      );
      return res.redirect(`/register`);
    }

    if (password !== confirmPassword) {
      await setBannerCookie("warning", "Passwords do not match.", res);
      return res.redirect(`/register`);
    }

    try {
      const userGetter = new UserGetter();
      const user = await userGetter.byUsername(username);

      if (!user) {
        await setBannerCookie(
          "danger",
          "We could not find a Minecraft account with that username. Please join the server first.",
          res
        );
        return res.redirect(`/register`);
      }

      if (user.email_verified && user.password_hash) {
        await setBannerCookie(
          "info",
          "This user already has an active web account. Please sign in instead.",
          res
        );
        return res.redirect(`/login`);
      }

      const existingEmailOwner = await userGetter.byEmail(email);
      if (existingEmailOwner && existingEmailOwner.userId !== user.userId) {
        await setBannerCookie(
          "danger",
          "That email address is already in use by another account.",
          res
        );
        return res.redirect(`/register`);
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const { token, tokenHash } = generateToken();
      const expiry = tokenExpiry(EMAIL_TOKEN_EXPIRY_MINUTES);

      await updateUserCredentials(user.userId, email, passwordHash, tokenHash, expiry);

      const verifyUrl = `${process.env.siteAddress}/verify-email?token=${token}`;
      await sendEmailVerificationMail(email, user.username, verifyUrl);

      await setBannerCookie(
        "success",
        "Registration successful! Check your inbox to verify your email.",
        res
      );
      return res.redirect(`/login`);
    } catch (error) {
      console.error("Registration error", error);
      await setBannerCookie(
        "danger",
        "We were unable to create your account. Please try again soon.",
        res
      );
      return res.redirect(`/register`);
    }
  });

  app.get("/verify-email", async function (req, res) {
    const token = req.query?.token;
    if (!token) {
      await setBannerCookie("danger", "Verification token is missing.", res);
      return res.redirect(`/login`);
    }

    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const userGetter = new UserGetter();
      const user = await userGetter.byEmailVerificationToken(tokenHash);

      if (!user) {
        await setBannerCookie("danger", "That verification link is invalid or has already been used.", res);
        return res.redirect(`/login`);
      }

      if (user.email_verification_expires && new Date(user.email_verification_expires) < new Date()) {
        await setBannerCookie(
          "danger",
          "That verification link has expired. Please request a new email verification.",
          res
        );
        await clearEmailVerificationToken(user.userId);
        return res.redirect(`/login`);
      }

      await markEmailVerified(user.userId);
      await setBannerCookie(
        "success",
        "Your email address has been verified. You can now sign in!",
        res
      );
      return res.redirect(`/login`);
    } catch (error) {
      console.error("Email verification error", error);
      await setBannerCookie(
        "danger",
        "We could not verify your email address. Please try again later.",
        res
      );
      return res.redirect(`/login`);
    }
  });

  app.get("/forgot-password", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    return res.view("session/forgotPassword", {
      pageTitle: `Forgot password`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/forgot-password", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    const email = normalizeEmail(req.body?.email || "");

    if (!email) {
      await setBannerCookie("warning", "Please provide your email address.", res);
      return res.redirect(`/forgot-password`);
    }

    try {
      const userGetter = new UserGetter();
      const user = await userGetter.byEmail(email);

      if (user) {
        const { token, tokenHash } = generateToken();
        const expiry = tokenExpiry(PASSWORD_TOKEN_EXPIRY_MINUTES);
        await savePasswordResetToken(user.userId, tokenHash, expiry);

        const resetUrl = `${process.env.siteAddress}/reset-password?token=${token}`;
        await sendPasswordResetMail(email, user.username, resetUrl);
      }

      await setBannerCookie(
        "success",
        "If that email exists in our system you will receive a reset link shortly.",
        res
      );
      return res.redirect(`/forgot-password`);
    } catch (error) {
      console.error("Forgot password error", error);
      await setBannerCookie(
        "danger",
        "We were unable to start the password reset. Please try again soon.",
        res
      );
      return res.redirect(`/forgot-password`);
    }
  });

  app.get("/reset-password", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    const token = req.query?.token;
    if (!token) {
      await setBannerCookie("danger", "Password reset token is missing.", res);
      return res.redirect(`/login`);
    }

    return res.view("session/resetPassword", {
      pageTitle: `Reset password`,
      config: config,
      req: req,
      token: token,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/reset-password", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    const token = req.body?.token;
    const password = req.body?.password?.trim();
    const confirmPassword = req.body?.confirmPassword?.trim();

    if (!token || !password || !confirmPassword) {
      await setBannerCookie("warning", "All fields are required.", res);
      return res.redirect(`/reset-password?token=${encodeURIComponent(token || "")}`);
    }

    if (password.length < 8) {
      await setBannerCookie(
        "warning",
        "Password must be at least 8 characters long.",
        res
      );
      return res.redirect(`/reset-password?token=${encodeURIComponent(token)}`);
    }

    if (password !== confirmPassword) {
      await setBannerCookie("warning", "Passwords do not match.", res);
      return res.redirect(`/reset-password?token=${encodeURIComponent(token)}`);
    }

    try {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const userGetter = new UserGetter();
      const user = await userGetter.byPasswordResetToken(tokenHash);

      if (!user || !user.password_reset_expires) {
        await setBannerCookie(
          "danger",
          "That password reset link is invalid or has already been used.",
          res
        );
        return res.redirect(`/login`);
      }

      if (new Date(user.password_reset_expires) < new Date()) {
        await setBannerCookie(
          "danger",
          "That password reset link has expired. Please start again.",
          res
        );
        await clearPasswordResetToken(user.userId);
        return res.redirect(`/forgot-password`);
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await updatePassword(user.userId, passwordHash);
      await clearPasswordResetToken(user.userId);

      await setBannerCookie(
        "success",
        "Your password has been updated. You can now sign in.",
        res
      );
      return res.redirect(`/login`);
    } catch (error) {
      console.error("Reset password error", error);
      await setBannerCookie(
        "danger",
        "We could not reset your password. Please try again soon.",
        res
      );
      return res.redirect(`/forgot-password`);
    }
  });

  app.get("/account/settings", async function (req, res) {
    if (!req.session.user) {
      await setBannerCookie("warning", "Please sign in to manage your account.", res);
      return res.redirect(`/login`);
    }

    return res.view("session/accountSettings", {
      pageTitle: `Account settings`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/account/change-email", async function (req, res) {
    if (!req.session.user) {
      await setBannerCookie("warning", "Please sign in to continue.", res);
      return res.redirect(`/login`);
    }

    const email = normalizeEmail(req.body?.email || "");
    const password = req.body?.password?.trim();

    if (!email || !password) {
      await setBannerCookie("warning", "Email and password are required.", res);
      return res.redirect(`/account/settings`);
    }

    try {
      const userGetter = new UserGetter();
      const currentUser = await userGetter.byUsername(req.session.user.username);

      if (!currentUser || !currentUser.password_hash) {
        await setBannerCookie(
          "danger",
          "We could not validate your account. Please sign in again.",
          res
        );
        return res.redirect(`/login`);
      }

      const passwordMatches = await bcrypt.compare(
        password,
        currentUser.password_hash
      );

      if (!passwordMatches) {
        await setBannerCookie("danger", "Your password was incorrect.", res);
        return res.redirect(`/account/settings`);
      }

      if (currentUser.email && currentUser.email.toLowerCase() === email) {
        await setBannerCookie(
          "info",
          "That email address is already set on your account.",
          res
        );
        return res.redirect(`/account/settings`);
      }

      const existingEmailOwner = await userGetter.byEmail(email);
      if (existingEmailOwner && existingEmailOwner.userId !== currentUser.userId) {
        await setBannerCookie(
          "danger",
          "That email is already in use by another account.",
          res
        );
        return res.redirect(`/account/settings`);
      }

      const { token, tokenHash } = generateToken();
      const expiry = tokenExpiry(EMAIL_TOKEN_EXPIRY_MINUTES);

      await updateEmail(currentUser.userId, email, tokenHash, expiry);

      const verifyUrl = `${process.env.siteAddress}/verify-email?token=${token}`;
      await sendEmailVerificationMail(email, currentUser.username, verifyUrl);

      req.session.user.email = email;

      await setBannerCookie(
        "success",
        "We've sent a verification link to your new email. Please confirm it to finish updating your account.",
        res
      );
      return res.redirect(`/account/settings`);
    } catch (error) {
      console.error("Change email error", error);
      await setBannerCookie(
        "danger",
        "We could not update your email address right now.",
        res
      );
      return res.redirect(`/account/settings`);
    }
  });

  app.post("/account/change-password", async function (req, res) {
    if (!req.session.user) {
      await setBannerCookie("warning", "Please sign in to continue.", res);
      return res.redirect(`/login`);
    }

    const currentPassword = req.body?.currentPassword?.trim();
    const newPassword = req.body?.newPassword?.trim();
    const confirmPassword = req.body?.confirmPassword?.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      await setBannerCookie("warning", "All password fields are required.", res);
      return res.redirect(`/account/settings`);
    }

    if (newPassword.length < 8) {
      await setBannerCookie(
        "warning",
        "New password must be at least 8 characters long.",
        res
      );
      return res.redirect(`/account/settings`);
    }

    if (newPassword !== confirmPassword) {
      await setBannerCookie("warning", "New passwords do not match.", res);
      return res.redirect(`/account/settings`);
    }

    try {
      const userGetter = new UserGetter();
      const currentUser = await userGetter.byUsername(req.session.user.username);

      if (!currentUser || !currentUser.password_hash) {
        await setBannerCookie(
          "danger",
          "We could not validate your account. Please sign in again.",
          res
        );
        return res.redirect(`/login`);
      }

      const passwordMatches = await bcrypt.compare(
        currentPassword,
        currentUser.password_hash
      );

      if (!passwordMatches) {
        await setBannerCookie("danger", "Your current password was incorrect.", res);
        return res.redirect(`/account/settings`);
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await updatePassword(currentUser.userId, passwordHash);

      await setBannerCookie(
        "success",
        "Your password has been updated.",
        res
      );
      return res.redirect(`/account/settings`);
    } catch (error) {
      console.error("Change password error", error);
      await setBannerCookie(
        "danger",
        "We could not update your password right now.",
        res
      );
      return res.redirect(`/account/settings`);
    }
  });

  //
  // Discord authentication
  //
  app.get("/login/discord", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    const action = req.session.user ? "link" : "login";
    const state = createDiscordState(req, action);

    const params = {
      client_id: process.env.discordClientId,
      redirect_uri: `${process.env.siteAddress}/login/callback`,
      response_type: "code",
      scope: "identify",
      state: state,
    };

    const authorizeUrl = `https://discord.com/api/oauth2/authorize?${qs.stringify(
      params
    )}`;

    res.redirect(authorizeUrl);
  });

  app.get("/login/callback", async (req, res) => {
    const { code, state: stateParam } = req.query;

    const state = parseDiscordState(req, stateParam);
    if (!state) {
      await setBannerCookie(
        "danger",
        "Discord authentication state did not match. Please try again.",
        res
      );
      return res.redirect(`/login`);
    }

    try {
      if (!code) {
        throw new Error("Authorization code is missing");
      }

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
      const userGetter = new UserGetter();

      if (state.action === "link") {
        if (!req.session.user) {
          await setBannerCookie(
            "danger",
            "You must be signed in to connect your Discord account.",
            res
          );
          return res.redirect(`/login`);
        }

        const existingOwner = await userGetter.byDiscordId(userData.id);
        if (existingOwner && existingOwner.userId !== req.session.user.userId) {
          await setBannerCookie(
            "danger",
            "That Discord account is already linked to another user.",
            res
          );
          return res.redirect(`/account/settings`);
        }

        await linkDiscordAccount(req.session.user.userId, userData.id);
        req.session.user.discordID = userData.id;

        await setBannerCookie(
          "success",
          "Your Discord account has been linked successfully.",
          res
        );
        return res.redirect(`/account/settings`);
      }

      const existingUser = await userGetter.byDiscordId(userData.id);

      if (!existingUser) {
        res.cookie("discordId", userData.id, {
          path: "/",
          httpOnly: true,
          maxAge: 600000,
        });

        console.log("User is unregistered, redirecting to /unregistered");
        return res.redirect(`/unregistered`);
      }

      await buildSession(req, existingUser);
      return res.redirect(`${process.env.siteAddress}/`);
    } catch (error) {
      console.error("Discord login error:", error);
      await setBannerCookie(
        "danger",
        "We could not complete the Discord sign in.",
        res
      );
      return res.redirect(`/login`);
    }
  });

  app.get("/unregistered", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    const discordId = req.cookies.discordId;
    if (!discordId) return res.redirect(`/`);

    const fetchURL = `${process.env.siteAddress}/api/server/get?type=VERIFICATION`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

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
