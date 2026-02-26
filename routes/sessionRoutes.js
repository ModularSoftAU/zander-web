import dotenv from "dotenv";
dotenv.config();
import qs from "querystring";
import bcrypt from "bcrypt";
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
  createLocalUser,
  updateLocalUserCredentials,
  updateUserPassword,
  markEmailVerified,
  markAccountRegistered,
  UserLinkGetter,
} from "../controllers/userController.js";
import { updateAudit_lastWebsiteLogin } from "../controllers/auditController.js";
import {
  createEmailVerification,
  generateVerificationCode,
  verifyEmailCode,
  createPasswordResetRequest,
  verifyPasswordResetCode,
} from "../controllers/sessionController.js";
import { sendMail } from "../controllers/emailController.js";

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
  const emailVerificationExpiryMinutes = 10;
  const passwordResetExpiryMinutes = 10;
  const passwordRequirements = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

  const buildDiscordAuthorizeUrl = () => {
    const params = {
      client_id: process.env.discordClientId,
      redirect_uri: `${process.env.siteAddress}/login/callback`,
      response_type: "code",
      scope: "identify",
    };

    return `https://discord.com/api/oauth2/authorize?${qs.stringify(params)}`;
  };

  const normaliseEmail = (email) => (email || "").trim().toLowerCase();

  const formatMojangUuid = (rawUuid) => {
    if (!rawUuid) return null;

    const cleaned = rawUuid.replace(/-/g, "");
    if (cleaned.length !== 32) {
      return null;
    }

    return `${cleaned.substring(0, 8)}-${cleaned.substring(8, 12)}-${cleaned.substring(
      12,
      16
    )}-${cleaned.substring(16, 20)}-${cleaned.substring(20)}`;
  };

  const logRouteError = (context, error) => {
    const message =
      error && typeof error === "object" && "message" in error
        ? error.message
        : String(error ?? "Unknown error");

    const details = [];
    if (error && typeof error === "object") {
      if ("code" in error && error.code) {
        details.push(`code=${error.code}`);
      }
      if ("status" in error && error.status) {
        details.push(`status=${error.status}`);
      }
      if ("responseCode" in error && error.responseCode) {
        details.push(`responseCode=${error.responseCode}`);
      }
    }

    const suffix = details.length ? ` (${details.join(", ")})` : "";
    console.error(`[SESSION] ${context}: ${message}${suffix}`);
  };

  async function hydrateUserSession(req, userLoginData) {
    const userPermissionData = await getUserPermissions(userLoginData);
    const userRanks = userPermissionData.userRanks || [];

    req.session.authenticated = true;
    req.session.user = {
      userId: userLoginData.userId,
      username: userLoginData.username,
      profilePicture: await getProfilePicture(userLoginData.username),
      discordID: userLoginData.discordId,
      uuid: userLoginData.uuid,
      ranks: userRanks,
      permissions: userPermissionData,
      isStaff: userRanks.some(rank => rank.isStaff),
    };

    await updateAudit_lastWebsiteLogin(new Date(), userLoginData.username);
  }

  app.get("/login", async function (req, res) {
    if (req.query.returnTo && typeof req.query.returnTo === "string") {
      const sanitizedReturnTo = req.query.returnTo.startsWith("/")
        ? req.query.returnTo
        : null;
      if (sanitizedReturnTo) {
        req.session.returnTo = sanitizedReturnTo;
      }
    }

    if (!req.session.returnTo && req.headers.referer) {
      try {
        const refererUrl = new URL(req.headers.referer);
        const siteAddress = process.env.siteAddress;
        const isSameHost =
          (siteAddress && req.headers.referer.startsWith(siteAddress)) ||
          (req.headers.host && refererUrl.host === req.headers.host);
        if (isSameHost) {
          const refererPath = `${refererUrl.pathname}${refererUrl.search}`;
          if (!refererPath.startsWith("/login") && !refererPath.startsWith("/logout")) {
            req.session.returnTo = refererPath;
          }
        }
      } catch (error) {
        // Ignore invalid referer values.
      }
    }

    if (req.session.user) {
      const returnTo =
        typeof req.session.returnTo === "string" &&
        req.session.returnTo.startsWith("/")
          ? req.session.returnTo
          : null;
      if (returnTo) {
        delete req.session.returnTo;
        { res.redirect(returnTo); return; };
      }
      { res.redirect("/dashboard"); return; };
    }

    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    const discordAuthorizeUrl = buildDiscordAuthorizeUrl();

    if (req.query.provider === "discord") {
      { res.redirect(discordAuthorizeUrl); return; };
    }

    await res.view("session/login", {
      pageTitle: `Login`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      discordAuthorizeUrl,
    });
  });

  app.post("/login", async function (req, res) {
    if (req.session.user) {
      { res.redirect("/dashboard"); return; };
    }

    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    const identifier = req.body.identifier ? req.body.identifier.trim() : "";
    const password = req.body.password || "";

    if (!identifier || !password) {
      await setBannerCookie("warning", "Username/email and password are required.", res);
      { res.redirect(`/login`); return; };
    }

    try {
      const userGetter = new UserGetter();
      const user = await userGetter.byUsernameOrEmail(identifier);

      if (!user || !user.password_hash) {
        await setBannerCookie("danger", "Invalid credentials.", res);
        { res.redirect(`/login`); return; };
      }

      if (user.account_disabled) {
        await setBannerCookie(
          "danger",
          "Your account is disabled. Please contact the team for assistance.",
          res
        );
        { res.redirect(`/login`); return; };
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        await setBannerCookie("danger", "Invalid credentials.", res);
        { res.redirect(`/login`); return; };
      }

      if (!user.email_verified) {
        req.session.pendingRegistration = {
          userId: user.userId,
          username: user.username,
          email: user.email,
          stage: "EMAIL",
        };
        await setBannerCookie("warning", "Please verify your email to continue.", res);
        { res.redirect(`/register/verify-email`); return; };
      }

      if (!user.account_registered) {
        req.session.pendingRegistration = {
          userId: user.userId,
          username: user.username,
          email: user.email,
          stage: "MINECRAFT",
        };
        await setBannerCookie(
          "warning",
          "Please finish verifying your Minecraft account to continue.",
          res
        );
        { res.redirect(`/register/minecraft`); return; };
      }

      await hydrateUserSession(req, user);
      delete req.session.passwordReset;

      // Extend session to 30 days if "Remember Me" is checked
      if (req.body.rememberMe) {
        req.session.cookie.maxAge = 86400000 * 30; // 30 days
      }

      await setBannerCookie("success", "Logged in successfully.", res);
      const returnTo =
        typeof req.session.returnTo === "string" &&
        req.session.returnTo.startsWith("/")
          ? req.session.returnTo
          : null;
      if (returnTo) {
        delete req.session.returnTo;
        { res.redirect(returnTo); return; };
      }
      { res.redirect(`${process.env.siteAddress}/`); return; };
    } catch (error) {
      logRouteError("local login attempt", error);
      await setBannerCookie("danger", "Unable to log in, please try again soon.", res);
      { res.redirect(`/login`); return; };
    }
  });

  app.get("/login/discord", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    if (req.query.returnTo && typeof req.query.returnTo === "string") {
      const sanitizedReturnTo = req.query.returnTo.startsWith("/")
        ? req.query.returnTo
        : null;
      if (sanitizedReturnTo) {
        req.session.returnTo = sanitizedReturnTo;
      }
    }

    { res.redirect(buildDiscordAuthorizeUrl()); return; };
  });

  app.get("/login/callback", async (req, res) => {
    const { code } = req.query;

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

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: qs.stringify(tokenParams),
      });

      if (!tokenResponse.ok) {
        const errorText = `Failed to obtain access token: ${tokenResponse.status} ${tokenResponse.statusText}`;
        logRouteError("discord token exchange", errorText);
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
        logRouteError("discord user fetch", errorText);
        throw new Error(errorText);
      }

      const userData = await userResponse.json();
      const userGetData = new UserGetter();
      const userIsRegistered = await userGetData.isRegistered(userData.id);

      if (!userIsRegistered) {
        res.cookie("discordId", userData.id, {
          path: "/",
          httpOnly: true,
          maxAge: 10 * 60 * 1000,
        });

        { res.redirect(`/unregistered`); return; };
      }

      const userLoginData = await userGetData.byDiscordId(userData.id);
      await hydrateUserSession(req, userLoginData);
      delete req.session.passwordReset;

      const returnTo =
        typeof req.session.returnTo === "string" &&
        req.session.returnTo.startsWith("/")
          ? req.session.returnTo
          : null;
      if (returnTo) {
        delete req.session.returnTo;
        { res.redirect(returnTo); return; };
      }
      { res.redirect(`${process.env.siteAddress}/`); return; };
    } catch (error) {
      logRouteError("discord OAuth callback", error);
      await setBannerCookie("danger", "Discord authentication failed.", res);
      { res.redirect(`/login`); return; };
    }
  });

  app.get("/forgot-password", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    if (req.session.user) {
      { res.redirect(`/`); return; };
    }

    await res.view("session/forgotPassword", {
      pageTitle: `Forgot Password`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/forgot-password", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    if (req.session.user) {
      { res.redirect(`/`); return; };
    }

    const identifier = req.body.identifier ? req.body.identifier.trim() : "";

    if (!identifier) {
      await setBannerCookie(
        "warning",
        "Please provide a username or email address.",
        res
      );
      { res.redirect(`/forgot-password`); return; };
    }

    try {
      const userGetter = new UserGetter();
      const user = await userGetter.byUsernameOrEmail(identifier);

      if (user && user.email && user.password_hash) {
        const code = await generateVerificationCode();
        const expiresAt = new Date(
          Date.now() + passwordResetExpiryMinutes * 60 * 1000
        );

        await createPasswordResetRequest(user.userId, code, expiresAt);

        await sendMail(
          user.email,
          `Reset your ${config.siteConfiguration.siteName} password`,
          "passwordResetCode.ejs",
          {
            username: user.username,
            code,
            expiryMinutes: passwordResetExpiryMinutes,
            siteAddress: process.env.siteAddress,
            siteName: config.siteConfiguration.siteName,
          }
        );

        req.session.passwordReset = {
          userId: user.userId,
          username: user.username,
          email: user.email,
          stage: "CODE",
        };
      } else {
        req.session.passwordReset = {
          stage: "CODE",
        };
      }

      await setBannerCookie(
        "success",
        "If an account exists with those details, we've emailed a verification code.",
        res
      );

      { res.redirect(`/forgot-password/verify`); return; };
    } catch (error) {
      logRouteError("start password reset", error);
      await setBannerCookie(
        "danger",
        "We couldn't start a password reset right now. Please try again soon.",
        res
      );
      { res.redirect(`/forgot-password`); return; };
    }
  });

  app.get("/forgot-password/verify", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    const passwordReset = req.session.passwordReset;

    if (!passwordReset || passwordReset.stage !== "CODE") {
      { res.redirect(`/forgot-password`); return; };
    }

    await res.view("session/forgotPasswordVerify", {
      pageTitle: `Verify Reset Code`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      username: passwordReset.username,
      expiryMinutes: passwordResetExpiryMinutes,
    });
  });

  app.post("/forgot-password/verify", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    const passwordReset = req.session.passwordReset;

    if (!passwordReset || passwordReset.stage !== "CODE") {
      await setBannerCookie(
        "danger",
        "Your reset request could not be found. Please start again.",
        res
      );
      { res.redirect(`/forgot-password`); return; };
    }

    const code = req.body.code ? req.body.code.trim() : "";

    if (!code) {
      await setBannerCookie("warning", "Please enter the verification code.", res);
      { res.redirect(`/forgot-password/verify`); return; };
    }

    if (!passwordReset.userId) {
      await setBannerCookie("danger", "We couldn't verify that code.", res);
      { res.redirect(`/forgot-password/verify`); return; };
    }

    try {
      const verification = await verifyPasswordResetCode(
        passwordReset.userId,
        code
      );

      if (!verification.valid) {
        let message = "We couldn't verify that code.";

        if (verification.reason === "expired") {
          message = "That code has expired. Please request a new password reset.";
        } else if (verification.reason === "consumed") {
          message = "That code has already been used. Please request a new password reset.";
        }

        await setBannerCookie("danger", message, res);
        { res.redirect(`/forgot-password/verify`); return; };
      }

      req.session.passwordReset.stage = "RESET";

      await setBannerCookie(
        "success",
        "Code verified! You can now choose a new password.",
        res
      );
      { res.redirect(`/forgot-password/reset`); return; };
    } catch (error) {
      logRouteError("verify password reset code", error);
      await setBannerCookie(
        "danger",
        "We couldn't verify that code right now. Please try again soon.",
        res
      );
      { res.redirect(`/forgot-password/verify`); return; };
    }
  });

  app.get("/forgot-password/reset", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    const passwordReset = req.session.passwordReset;

    if (
      !passwordReset ||
      passwordReset.stage !== "RESET" ||
      !passwordReset.userId
    ) {
      { res.redirect(`/forgot-password`); return; };
    }

    await res.view("session/resetPassword", {
      pageTitle: `Choose a New Password`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/forgot-password/reset", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.login, req, res, features)))
      return;

    const passwordReset = req.session.passwordReset;

    if (
      !passwordReset ||
      passwordReset.stage !== "RESET" ||
      !passwordReset.userId
    ) {
      await setBannerCookie(
        "danger",
        "Your reset request could not be found. Please start again.",
        res
      );
      { res.redirect(`/forgot-password`); return; };
    }

    const password = req.body.password || "";
    const confirmPassword = req.body.confirmPassword || "";

    if (!password || !confirmPassword) {
      await setBannerCookie("warning", "Please complete all password fields.", res);
      { res.redirect(`/forgot-password/reset`); return; };
    }

    if (password !== confirmPassword) {
      await setBannerCookie("danger", "Passwords do not match.", res);
      { res.redirect(`/forgot-password/reset`); return; };
    }

    if (!passwordRequirements.test(password)) {
      await setBannerCookie(
        "warning",
        "Password must be at least 8 characters and include uppercase, lowercase and a number.",
        res
      );
      { res.redirect(`/forgot-password/reset`); return; };
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12);
      await updateUserPassword(passwordReset.userId, passwordHash);

      delete req.session.passwordReset;

      await setBannerCookie(
        "success",
        "Your password has been reset. You can now sign in.",
        res
      );
      { res.redirect(`/login`); return; };
    } catch (error) {
      logRouteError("complete password reset", error);
      await setBannerCookie(
        "danger",
        "We couldn't reset your password right now. Please try again soon.",
        res
      );
      { res.redirect(`/forgot-password/reset`); return; };
    }
  });

  app.get("/register", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.register, req, res, features)))
      return;

    if (req.session.user) {
      { res.redirect(`/`); return; };
    }

    await res.view("session/register", {
      pageTitle: `Register`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
    });
  });

  app.post("/register", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.register, req, res, features)))
      return;

    const username = req.body.username ? req.body.username.trim() : "";
    const email = normaliseEmail(req.body.email);
    const password = req.body.password || "";

    if (!username || !email || !password) {
      await setBannerCookie("warning", "All fields are required.", res);
      { res.redirect(`/register`); return; };
    }

    if (!passwordRequirements.test(password)) {
      await setBannerCookie(
        "warning",
        "Password must be at least 8 characters and include uppercase, lowercase and a number.",
        res
      );
      { res.redirect(`/register`); return; };
    }

    try {
      const userGetter = new UserGetter();
      const existingUsername = await userGetter.byUsername(username);

      let formattedUuid;
      const isBedrock = username.startsWith(".");

      if (isBedrock) {
        // Bedrock players (Floodgate prefix) are not in the Mojang API.
        // Look up their UUID from the server database instead.
        formattedUuid = await userGetter.getBedrockUuid(username);

        if (!formattedUuid) {
          await setBannerCookie(
            "danger",
            "We could not find that Bedrock username. Make sure you have joined the server at least once.",
            res
          );
          { res.redirect(`/register`); return; };
        }
      } else {
        const profileResponse = await fetch(
          `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`
        );

        if (profileResponse.status === 204 || profileResponse.status === 404) {
          await setBannerCookie("danger", "We could not find that Minecraft username.", res);
          { res.redirect(`/register`); return; };
        }

        if (!profileResponse.ok) {
          throw new Error("Failed to validate Minecraft username");
        }

        const profileData = await profileResponse.json();
        formattedUuid = formatMojangUuid(profileData.id);
      }

      if (!formattedUuid) {
        await setBannerCookie("danger", "Invalid Minecraft UUID returned.", res);
        { res.redirect(`/register`); return; };
      }

      const existingUuidUser = await userGetter.byUUID(formattedUuid);

      if (
        existingUsername &&
        (!existingUuidUser || existingUsername.userId !== existingUuidUser.userId)
      ) {
        await setBannerCookie("danger", "That username is already registered.", res);
        { res.redirect(`/register`); return; };
      }

      if (existingUuidUser && existingUuidUser.account_registered) {
        await setBannerCookie("danger", "An account already exists for this Minecraft player.", res);
        { res.redirect(`/register`); return; };
      }

      if (!existingUuidUser) {
        const hasJoinedServer = await userGetter.hasJoined(
          username,
          formattedUuid
        );

        if (!hasJoinedServer) {
          await setBannerCookie(
            "danger",
            "You need to join the Minecraft server before creating a website account.",
            res
          );
          { res.redirect(`/register`); return; };
        }
      }

      const existingEmail = await userGetter.byEmail(email);
      if (
        existingEmail &&
        existingEmail.password_hash &&
        existingEmail.account_registered &&
        (!existingUuidUser || existingEmail.userId !== existingUuidUser.userId)
      ) {
        await setBannerCookie("danger", "That email address is already in use.", res);
        { res.redirect(`/register`); return; };
      }

      const passwordHash = await bcrypt.hash(password, 12);

      let userId;

      if (existingUuidUser) {
        await updateLocalUserCredentials(existingUuidUser.userId, {
          email,
          passwordHash,
          username,
        });
        userId = existingUuidUser.userId;
      } else {
        const newUser = await createLocalUser({
          uuid: formattedUuid,
          username,
          email,
          passwordHash,
        });
        userId = newUser.userId;
      }

      const verificationCode = await generateVerificationCode();
      const expiresAt = new Date(Date.now() + emailVerificationExpiryMinutes * 60000);
      await createEmailVerification(userId, verificationCode, expiresAt);

      await sendMail(
        email,
        `${config.siteConfiguration.siteName} Email Verification`,
        "verificationCode.ejs",
        {
          username,
          code: verificationCode,
          expiryMinutes: emailVerificationExpiryMinutes,
          siteName: config.siteConfiguration.siteName,
        }
      );

      req.session.pendingRegistration = {
        userId,
        username,
        email,
        stage: "EMAIL",
      };

      await setBannerCookie("success", "We sent a verification code to your email.", res);
      { res.redirect(`/register/verify-email`); return; };
    } catch (error) {
      logRouteError("start registration", error);
      await setBannerCookie("danger", "We were unable to create your account.", res);
      { res.redirect(`/register`); return; };
    }
  });

  app.get("/register/verify-email", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.register, req, res, features)))
      return;

    const pendingRegistration = req.session.pendingRegistration;

    if (!pendingRegistration || !pendingRegistration.userId) {
      await setBannerCookie("warning", "Start by creating an account first.", res);
      { res.redirect(`/register`); return; };
    }

    await res.view("session/registerVerifyEmail", {
      pageTitle: `Verify Email`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      email: pendingRegistration.email,
      expiryMinutes: emailVerificationExpiryMinutes,
    });
  });

  app.post("/register/verify-email", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.register, req, res, features)))
      return;

    const pendingRegistration = req.session.pendingRegistration;
    if (!pendingRegistration || !pendingRegistration.userId) {
      await setBannerCookie("warning", "Start by creating an account first.", res);
      { res.redirect(`/register`); return; };
    }

    const code = [
      req.body.first,
      req.body.second,
      req.body.third,
      req.body.fourth,
      req.body.fifth,
      req.body.sixth,
    ]
      .join("")
      .trim();

    if (code.length !== 6) {
      await setBannerCookie("danger", "Please enter the 6 digit code from your email.", res);
      { res.redirect(`/register/verify-email`); return; };
    }

    try {
      const verificationResult = await verifyEmailCode(pendingRegistration.userId, code);

      if (!verificationResult.valid) {
        await setBannerCookie("danger", "That verification code is invalid or expired.", res);
        { res.redirect(`/register/verify-email`); return; };
      }

      await markEmailVerified(pendingRegistration.userId);
      req.session.pendingRegistration.stage = "MINECRAFT";

      await setBannerCookie(
        "success",
        "Email verified! Now verify your Minecraft account.",
        res
      );
      { res.redirect(`/register/minecraft`); return; };
    } catch (error) {
      logRouteError("verify registration email", error);
      await setBannerCookie("danger", "We were unable to verify that code.", res);
      { res.redirect(`/register/verify-email`); return; };
    }
  });

  app.get("/register/minecraft", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.register, req, res, features)))
      return;

    const pendingRegistration = req.session.pendingRegistration;

    if (!pendingRegistration || !pendingRegistration.userId) {
      await setBannerCookie("warning", "Start by creating an account first.", res);
      { res.redirect(`/register`); return; };
    }

    if (pendingRegistration.stage !== "MINECRAFT") {
      await setBannerCookie("warning", "Please verify your email before continuing.", res);
      { res.redirect(`/register/verify-email`); return; };
    }

    const fetchURL = `${process.env.siteAddress}/api/server/get?type=VERIFICATION`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    await res.view("session/registerMinecraft", {
      pageTitle: `Verify Minecraft`,
      config: config,
      req: req,
      apiData: apiData,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      pendingUserId: pendingRegistration.userId,
    });
  });

  app.post("/register/minecraft", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.register, req, res, features)))
      return;

    const pendingRegistration = req.session.pendingRegistration;

    if (!pendingRegistration || !pendingRegistration.userId) {
      await setBannerCookie("warning", "Start by creating an account first.", res);
      { res.redirect(`/register`); return; };
    }

    const code = [
      req.body.first,
      req.body.second,
      req.body.third,
      req.body.fourth,
      req.body.fifth,
      req.body.sixth,
    ]
      .join("")
      .trim();

    if (code.length !== 6) {
      await setBannerCookie("danger", "Please enter the 6 digit code from the Minecraft server.", res);
      { res.redirect(`/register/minecraft`); return; };
    }

    try {
      const userLinkData = new UserLinkGetter();
      const linkUser = await userLinkData.getUserByCode(code);

      if (!linkUser || linkUser.userId !== pendingRegistration.userId) {
        await setBannerCookie(
          "danger",
          "That verification code does not match your account.",
          res
        );
        { res.redirect(`/register/minecraft`); return; };
      }

      await userLinkData.markWebsiteRegistrationComplete(linkUser.uuid);
      await markAccountRegistered(pendingRegistration.userId);

      await hydrateUserSession(req, linkUser);
      delete req.session.pendingRegistration;

      await setBannerCookie("success", "Your account has been verified!", res);
      { res.redirect(`${process.env.siteAddress}/`); return; };
    } catch (error) {
      logRouteError("verify Minecraft registration", error);
      await setBannerCookie("danger", "Unable to verify that code right now.", res);
      { res.redirect(`/register/minecraft`); return; };
    }
  });

  app.get("/unregistered", async function (req, res) {
    if (!(await isFeatureWebRouteEnabled(features.web.register, req, res, features)))
      return;

    const discordId = req.cookies.discordId;
    if (!discordId) { res.redirect(`/`); return; };

    const fetchURL = `${process.env.siteAddress}/api/server/get?type=VERIFICATION`;
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });
    const apiData = await response.json();

    await res.view("session/unregistered", {
      pageTitle: `Unregistered`,
      config: config,
      req: req,
      apiData: apiData,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      discordId: discordId,
    });
  });

  app.get("/logout", async function (req, res) {
    try {
      await req.session.destroy();
      await setBannerCookie("success", lang.session.userLogout, res);
      { res.redirect(`${process.env.siteAddress}/`); return; };
    } catch (err) {
      logRouteError("destroy session during logout", err);
      throw err;
    }
  });
}
