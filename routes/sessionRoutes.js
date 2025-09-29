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
  isEmailServiceConfigured,
  getEmailConfigurationIssues,
} from "../controllers/emailController.js";
import {
  getPasswordPolicy,
  getPasswordRequirementList,
  validatePasswordAgainstPolicy,
} from "../utils/passwordPolicy.js";
import {
  createAuthFlowLogger,
  obfuscateValue,
} from "../utils/authFlowLogger.js";

const EMAIL_TOKEN_EXPIRY_MINUTES = 60;
const PASSWORD_TOKEN_EXPIRY_MINUTES = 30;
const EMAIL_DISPATCH_TIMEOUT_MS = 1000 * 15;

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

async function dispatchEmail(sendFn, contextLabel, logger) {
  if (!isEmailServiceConfigured()) {
    const missingFields = getEmailConfigurationIssues();
    const missingLabel = missingFields.length
      ? ` (missing ${missingFields.join(", ")})`
      : "";
    if (logger) {
      logger.warn({
        event: "email-dispatch-skip",
        reason: "service-unconfigured",
        missingFields,
      }, `${contextLabel}: email service is not configured${missingLabel}`);
    } else {
      console.warn(`${contextLabel}: email service is not configured${missingLabel}`);
    }
    return false;
  }

  const start = process.hrtime.bigint();
  logger?.info({ event: "email-dispatch-start" }, `${contextLabel}: sending email`);

  try {
    await Promise.race([
      sendFn(),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `${contextLabel} timed out after ${EMAIL_DISPATCH_TIMEOUT_MS}ms`
              )
            ),
          EMAIL_DISPATCH_TIMEOUT_MS
        )
      ),
    ]);
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger?.info(
      { event: "email-dispatch-success", durationMs },
      `${contextLabel}: email dispatched`
    );
    return true;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (logger) {
      logger.error(
        { event: "email-dispatch-failure", durationMs, err: error },
        `${contextLabel}: email failed`
      );
    } else {
      console.error(contextLabel, error);
    }
    return false;
  }
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
  const passwordPolicy = getPasswordPolicy(config);
  const passwordRequirements = getPasswordRequirementList(passwordPolicy);

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

    const emailHash = obfuscateValue(email);
    const authLog = createAuthFlowLogger(req, "web-login", {
      emailHash,
      hasPassword: Boolean(password),
    });
    const outcome = { status: "unknown", redirectTo: `/login` };

    try {
      authLog.step("validate-input");
      if (!email || !password) {
        outcome.status = "invalid-request";
        outcome.reason = "missing-credentials";
        authLog.log.warn({ reason: outcome.reason }, "Login rejected: missing credentials");
        await setBannerCookie("warning", "Please provide both email and password.", res);
        return res.redirect(303, `/login`);
      }

      authLog.step("lookup-user", { emailHash });
      const userGetter = new UserGetter();
      const user = await userGetter.byEmail(email);

      if (!user || !user.password_hash) {
        outcome.status = "invalid-credentials";
        outcome.reason = "user-not-found";
        authLog.log.warn({ reason: outcome.reason }, "Login rejected: user not found or password missing");
        await setBannerCookie("danger", "The provided credentials were invalid.", res);
        return res.redirect(303, `/login`);
      }

      if (!user.email_verified) {
        outcome.status = "email-unverified";
        outcome.reason = "email-not-verified";
        authLog.log.warn({ userId: user.userId }, "Login rejected: email not verified");
        await setBannerCookie(
          "warning",
          "You need to verify your email address before signing in.",
          res
        );
        return res.redirect(303, `/login`);
      }

      authLog.step("validate-password", { userId: user.userId });
      const passwordMatches = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatches) {
        outcome.status = "invalid-credentials";
        outcome.reason = "password-mismatch";
        authLog.log.warn({ userId: user.userId }, "Login rejected: password mismatch");
        await setBannerCookie("danger", "The provided credentials were invalid.", res);
        return res.redirect(303, `/login`);
      }

      authLog.step("build-session", { userId: user.userId });
      await buildSession(req, user);
      outcome.status = "success";
      outcome.redirectTo = `/`;
      authLog.log.info({ userId: user.userId, username: user.username }, "Login successful");
      return res.redirect(303, `/`);
    } catch (error) {
      outcome.status = "error";
      outcome.error = error.message;
      authLog.log.error({ err: error }, "Login error");
      await setBannerCookie("danger", "We were unable to log you in right now.", res);
      return res.redirect(303, `/login`);
    } finally {
      authLog.finish(outcome.status, {
        redirectTo: outcome.redirectTo,
        reason: outcome.reason,
        error: outcome.error,
      });
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
      passwordPolicy,
      passwordRequirements,
      emailServiceConfigured: isEmailServiceConfigured(),
    });
  });

  app.post("/register", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    const username = req.body?.username?.trim();
    const email = normalizeEmail(req.body?.email || "");
    const password = req.body?.password?.trim();
    const confirmPassword = req.body?.confirmPassword?.trim();
    const emailHash = obfuscateValue(email);
    const authLog = createAuthFlowLogger(req, "web-register", {
      username,
      emailHash,
    });
    const outcome = { status: "unknown", redirectTo: `/register` };

    try {
      authLog.step("validate-input", {
        hasUsername: Boolean(username),
        hasEmail: Boolean(email),
        hasPassword: Boolean(password),
        hasConfirm: Boolean(confirmPassword),
      });

      if (!username || !email || !password || !confirmPassword) {
        outcome.status = "invalid-request";
        outcome.reason = "missing-fields";
        authLog.log.warn({ reason: outcome.reason }, "Registration rejected: missing fields");
        await setBannerCookie("warning", "All fields are required.", res);
        return res.redirect(303, `/register`);
      }

      const passwordValidation = validatePasswordAgainstPolicy(
        password,
        passwordPolicy
      );
      if (!passwordValidation.valid) {
        outcome.status = "invalid-password";
        outcome.reason = passwordValidation.failedRules[0].key || "policy";
        authLog.log.warn({ reason: outcome.reason }, "Registration rejected: password failed policy");
        await setBannerCookie(
          "warning",
          passwordValidation.failedRules[0].message,
          res
        );
        return res.redirect(303, `/register`);
      }

      if (password !== confirmPassword) {
        outcome.status = "invalid-password";
        outcome.reason = "confirmation-mismatch";
        authLog.log.warn({ reason: outcome.reason }, "Registration rejected: passwords do not match");
        await setBannerCookie("warning", "Passwords do not match.", res);
        return res.redirect(303, `/register`);
      }

      if (!isEmailServiceConfigured()) {
        outcome.status = "smtp-unavailable";
        outcome.reason = "email-service-missing";
        authLog.log.warn({ reason: outcome.reason }, "Registration rejected: email service unavailable");
        await setBannerCookie(
          "danger",
          "We can't send verification emails right now. Please contact an administrator.",
          res
        );
        return res.redirect(303, `/register`);
      }

      const userGetter = new UserGetter();
      authLog.step("lookup-username", { username });
      const user = await userGetter.byUsername(username);

      if (!user) {
        outcome.status = "username-not-found";
        outcome.reason = "minecraft-account-missing";
        authLog.log.warn({ username }, "Registration rejected: minecraft account missing");
        await setBannerCookie(
          "danger",
          "We could not find a Minecraft account with that username. Please join the server first.",
          res
        );
        return res.redirect(303, `/register`);
      }

      if (user.email_verified && user.password_hash) {
        outcome.status = "already-registered";
        outcome.redirectTo = `/login`;
        authLog.log.info({ userId: user.userId }, "Registration redirected: account already active");
        await setBannerCookie(
          "info",
          "This user already has an active web account. Please sign in instead.",
          res
        );
        return res.redirect(303, `/login`);
      }

      authLog.step("lookup-email", { emailHash });
      const existingEmailOwner = await userGetter.byEmail(email);
      if (existingEmailOwner && existingEmailOwner.userId !== user.userId) {
        outcome.status = "email-in-use";
        outcome.reason = "email-owned-by-other-user";
        authLog.log.warn({ existingUserId: existingEmailOwner.userId }, "Registration rejected: email already in use");
        await setBannerCookie(
          "danger",
          "That email address is already in use by another account.",
          res
        );
        return res.redirect(303, `/register`);
      }

      authLog.step("hash-password", { userId: user.userId });
      const passwordHash = await bcrypt.hash(password, 12);
      const { token, tokenHash } = generateToken();
      const expiry = tokenExpiry(EMAIL_TOKEN_EXPIRY_MINUTES);

      const verifyUrl = `${process.env.siteAddress}/verify-email?token=${token}`;
      const emailLogger = authLog.log.child({ step: "send-verification-email", userId: user.userId });
      const emailDispatched = await dispatchEmail(
        () => sendEmailVerificationMail(email, user.username, verifyUrl),
        "Email verification dispatch failed",
        emailLogger
      );

      if (!emailDispatched) {
        outcome.status = "email-dispatch-failed";
        outcome.reason = "verification-email-failed";
        await setBannerCookie(
          "danger",
          "We couldn't send the verification email. Please try again shortly.",
          res
        );
        return res.redirect(303, `/register`);
      }

      authLog.step("persist-credentials", { userId: user.userId });
      await updateUserCredentials(user.userId, email, passwordHash, tokenHash, expiry);

      outcome.status = "success";
      outcome.redirectTo = `/login`;
      authLog.log.info({ userId: user.userId, username: user.username }, "Registration successful");
      await setBannerCookie(
        "success",
        "Registration successful! Check your inbox to verify your email.",
        res
      );
      return res.redirect(303, `/login`);
    } catch (error) {
      outcome.status = "error";
      outcome.error = error.message;
      authLog.log.error({ err: error }, "Registration error");
      await setBannerCookie(
        "danger",
        "We were unable to create your account. Please try again soon.",
        res
      );
      return res.redirect(303, `/register`);
    } finally {
      authLog.finish(outcome.status, {
        redirectTo: outcome.redirectTo,
        reason: outcome.reason,
        error: outcome.error,
      });
    }
  });

  app.get("/verify-email", async function (req, res) {
    const token = req.query?.token;
    const tokenPreview = obfuscateValue(token);
    const authLog = createAuthFlowLogger(req, "web-verify-email", {
      tokenProvided: Boolean(token),
      tokenPreview,
    });
    const outcome = { status: "unknown", redirectTo: `/login` };

    try {
      if (!token) {
        outcome.status = "invalid-request";
        outcome.reason = "missing-token";
        authLog.log.warn({ reason: outcome.reason }, "Email verification rejected: missing token");
        await setBannerCookie("danger", "Verification token is missing.", res);
        return res.redirect(303, `/login`);
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      authLog.step("lookup-token", { tokenPreview });
      const userGetter = new UserGetter();
      const user = await userGetter.byEmailVerificationToken(tokenHash);

      if (!user) {
        outcome.status = "invalid-token";
        outcome.reason = "token-not-found";
        authLog.log.warn({ tokenPreview }, "Email verification rejected: token not found");
        await setBannerCookie("danger", "That verification link is invalid or has already been used.", res);
        return res.redirect(303, `/login`);
      }

      if (user.email_verification_expires && new Date(user.email_verification_expires) < new Date()) {
        outcome.status = "invalid-token";
        outcome.reason = "token-expired";
        authLog.log.warn({ userId: user.userId }, "Email verification rejected: token expired");
        await setBannerCookie(
          "danger",
          "That verification link has expired. Please request a new email verification.",
          res
        );
        await clearEmailVerificationToken(user.userId);
        return res.redirect(303, `/login`);
      }

      authLog.step("mark-verified", { userId: user.userId });
      await markEmailVerified(user.userId);
      outcome.status = "success";
      authLog.log.info({ userId: user.userId }, "Email verified successfully");
      await setBannerCookie(
        "success",
        "Your email address has been verified. You can now sign in!",
        res
      );
      return res.redirect(303, `/login`);
    } catch (error) {
      outcome.status = "error";
      outcome.error = error.message;
      authLog.log.error({ err: error }, "Email verification error");
      await setBannerCookie(
        "danger",
        "We could not verify your email address. Please try again later.",
        res
      );
      return res.redirect(303, `/login`);
    } finally {
      authLog.finish(outcome.status, {
        redirectTo: outcome.redirectTo,
        reason: outcome.reason,
        error: outcome.error,
      });
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
      emailServiceConfigured: isEmailServiceConfigured(),
    });
  });

  app.post("/forgot-password", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    const email = normalizeEmail(req.body?.email || "");
    const emailHash = obfuscateValue(email);
    const authLog = createAuthFlowLogger(req, "web-forgot-password", {
      emailHash,
    });
    const outcome = { status: "unknown", redirectTo: `/forgot-password` };

    try {
      authLog.step("validate-input", { hasEmail: Boolean(email) });
      if (!email) {
        outcome.status = "invalid-request";
        outcome.reason = "missing-email";
        authLog.log.warn({ reason: outcome.reason }, "Password reset rejected: missing email");
        await setBannerCookie("warning", "Please provide your email address.", res);
        return res.redirect(303, `/forgot-password`);
      }

      if (!isEmailServiceConfigured()) {
        outcome.status = "smtp-unavailable";
        outcome.reason = "email-service-missing";
        authLog.log.warn({ reason: outcome.reason }, "Password reset rejected: email service unavailable");
        await setBannerCookie(
          "danger",
          "We can't send password reset emails right now. Please contact an administrator.",
          res
        );
        return res.redirect(303, `/forgot-password`);
      }

      const userGetter = new UserGetter();
      authLog.step("lookup-email", { emailHash });
      const user = await userGetter.byEmail(email);

      if (user) {
        const { token, tokenHash } = generateToken();
        const expiry = tokenExpiry(PASSWORD_TOKEN_EXPIRY_MINUTES);
        const resetUrl = `${process.env.siteAddress}/reset-password?token=${token}`;

        const emailLogger = authLog.log.child({ step: "send-reset-email", userId: user.userId });
        const emailDispatched = await dispatchEmail(
          () => sendPasswordResetMail(email, user.username, resetUrl),
          "Password reset email dispatch failed",
          emailLogger
        );

        if (emailDispatched) {
          authLog.step("persist-reset-token", { userId: user.userId });
          await savePasswordResetToken(user.userId, tokenHash, expiry);
          outcome.status = "reset-email-sent";
        } else {
          outcome.status = "email-dispatch-failed";
          outcome.reason = "reset-email-failed";
          authLog.log.warn(
            { userId: user.userId },
            "Password reset email dispatch failed; token not persisted"
          );
        }
      } else {
        outcome.status = "user-not-found";
        outcome.reason = "email-not-associated";
        authLog.log.info({ emailHash }, "Password reset requested for non-existent email");
      }

      await setBannerCookie(
        "success",
        "If that email exists in our system you will receive a reset link shortly.",
        res
      );
      return res.redirect(303, `/forgot-password`);
    } catch (error) {
      outcome.status = "error";
      outcome.error = error.message;
      authLog.log.error({ err: error }, "Forgot password error");
      await setBannerCookie(
        "danger",
        "We were unable to start the password reset. Please try again soon.",
        res
      );
      return res.redirect(303, `/forgot-password`);
    } finally {
      authLog.finish(outcome.status, {
        redirectTo: outcome.redirectTo,
        reason: outcome.reason,
        error: outcome.error,
      });
    }
  });

  app.get("/reset-password", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    const token = req.query?.token;
    if (!token) {
      await setBannerCookie("danger", "Password reset token is missing.", res);
      return res.redirect(303, `/login`);
    }

    return res.view("session/resetPassword", {
      pageTitle: `Reset password`,
      config: config,
      req: req,
      token: token,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      passwordPolicy,
      passwordRequirements,
    });
  });

  app.post("/reset-password", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.login, req, res, features)) return;

    const token = req.body?.token;
    const password = req.body?.password?.trim();
    const confirmPassword = req.body?.confirmPassword?.trim();
    const tokenPreview = obfuscateValue(token);
    const authLog = createAuthFlowLogger(req, "web-reset-password", {
      tokenProvided: Boolean(token),
      tokenPreview,
    });
    const outcome = {
      status: "unknown",
      redirectTo: `/reset-password?token=${encodeURIComponent(token || "")}`,
    };

    try {
      authLog.step("validate-input", {
        hasToken: Boolean(token),
        hasPassword: Boolean(password),
        hasConfirm: Boolean(confirmPassword),
      });
      if (!token || !password || !confirmPassword) {
        outcome.status = "invalid-request";
        outcome.reason = "missing-fields";
        authLog.log.warn({ reason: outcome.reason }, "Reset password rejected: missing fields");
        await setBannerCookie("warning", "All fields are required.", res);
        return res.redirect(303, `/reset-password?token=${encodeURIComponent(token || "")}`);
      }

      const passwordValidation = validatePasswordAgainstPolicy(
        password,
        passwordPolicy
      );
      if (!passwordValidation.valid) {
        outcome.status = "invalid-password";
        outcome.reason = passwordValidation.failedRules[0].key || "policy";
        authLog.log.warn({ reason: outcome.reason }, "Reset password rejected: password failed policy");
        await setBannerCookie(
          "warning",
          passwordValidation.failedRules[0].message,
          res
        );
        return res.redirect(303, `/reset-password?token=${encodeURIComponent(token)}`);
      }

      if (password !== confirmPassword) {
        outcome.status = "invalid-password";
        outcome.reason = "confirmation-mismatch";
        authLog.log.warn({ reason: outcome.reason }, "Reset password rejected: confirmation mismatch");
        await setBannerCookie("warning", "Passwords do not match.", res);
        return res.redirect(303, `/reset-password?token=${encodeURIComponent(token)}`);
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      authLog.step("lookup-token", { tokenPreview });
      const userGetter = new UserGetter();
      const user = await userGetter.byPasswordResetToken(tokenHash);

      if (!user || !user.password_reset_expires) {
        outcome.status = "invalid-token";
        outcome.reason = "token-not-found";
        authLog.log.warn({ tokenPreview }, "Reset password rejected: token not found");
        await setBannerCookie(
          "danger",
          "That password reset link is invalid or has already been used.",
          res
        );
        return res.redirect(303, `/login`);
      }

      if (new Date(user.password_reset_expires) < new Date()) {
        outcome.status = "invalid-token";
        outcome.reason = "token-expired";
        authLog.log.warn({ userId: user.userId }, "Reset password rejected: token expired");
        await setBannerCookie(
          "danger",
          "That password reset link has expired. Please start again.",
          res
        );
        await clearPasswordResetToken(user.userId);
        return res.redirect(303, `/forgot-password`);
      }

      authLog.step("update-password", { userId: user.userId });
      const passwordHash = await bcrypt.hash(password, 12);
      await updatePassword(user.userId, passwordHash);
      await clearPasswordResetToken(user.userId);

      outcome.status = "success";
      outcome.redirectTo = `/login`;
      authLog.log.info({ userId: user.userId }, "Password reset successfully");
      await setBannerCookie(
        "success",
        "Your password has been updated. You can now sign in.",
        res
      );
      return res.redirect(303, `/login`);
    } catch (error) {
      outcome.status = "error";
      outcome.error = error.message;
      authLog.log.error({ err: error }, "Reset password error");
      await setBannerCookie(
        "danger",
        "We could not reset your password. Please try again soon.",
        res
      );
      return res.redirect(303, `/forgot-password`);
    } finally {
      authLog.finish(outcome.status, {
        redirectTo: outcome.redirectTo,
        reason: outcome.reason,
        error: outcome.error,
      });
    }
  });

  app.get("/account/settings", async function (req, res) {
    if (!req.session.user) {
      await setBannerCookie("warning", "Please sign in to manage your account.", res);
      return res.redirect(303, `/login`);
    }

    return res.view("session/accountSettings", {
      pageTitle: `Account settings`,
      config: config,
      req: req,
      features: features,
      globalImage: await getGlobalImage(),
      announcementWeb: await getWebAnnouncement(),
      passwordPolicy,
      passwordRequirements,
      emailServiceConfigured: isEmailServiceConfigured(),
    });
  });

  app.post("/account/change-email", async function (req, res) {
    if (!req.session.user) {
      await setBannerCookie("warning", "Please sign in to continue.", res);
      return res.redirect(303, `/login`);
    }

    const email = normalizeEmail(req.body?.email || "");
    const password = req.body?.password?.trim();
    const emailHash = obfuscateValue(email);
    const authLog = createAuthFlowLogger(req, "web-change-email", {
      emailHash,
      sessionUserId: req.session.user.userId,
    });
    const outcome = { status: "unknown", redirectTo: `/account/settings` };

    try {
      authLog.step("validate-input", {
        hasEmail: Boolean(email),
        hasPassword: Boolean(password),
      });
      if (!email || !password) {
        outcome.status = "invalid-request";
        outcome.reason = "missing-fields";
        authLog.log.warn({ reason: outcome.reason }, "Change email rejected: missing fields");
        await setBannerCookie("warning", "Email and password are required.", res);
        return res.redirect(303, `/account/settings`);
      }

      const userGetter = new UserGetter();
      authLog.step("lookup-user", { username: req.session.user.username });
      const currentUser = await userGetter.byUsername(req.session.user.username);

      if (!currentUser || !currentUser.password_hash) {
        outcome.status = "invalid-session";
        outcome.reason = "user-not-found";
        authLog.log.warn({ reason: outcome.reason }, "Change email rejected: session user invalid");
        await setBannerCookie(
          "danger",
          "We could not validate your account. Please sign in again.",
          res
        );
        return res.redirect(303, `/login`);
      }

      const passwordMatches = await bcrypt.compare(
        password,
        currentUser.password_hash
      );

      if (!passwordMatches) {
        outcome.status = "invalid-credentials";
        outcome.reason = "password-mismatch";
        authLog.log.warn({ userId: currentUser.userId }, "Change email rejected: incorrect password");
        await setBannerCookie("danger", "Your password was incorrect.", res);
        return res.redirect(303, `/account/settings`);
      }

      if (currentUser.email && currentUser.email.toLowerCase() === email) {
        outcome.status = "no-op";
        outcome.reason = "email-unchanged";
        authLog.log.info({ userId: currentUser.userId }, "Change email skipped: same email provided");
        await setBannerCookie(
          "info",
          "That email address is already set on your account.",
          res
        );
        return res.redirect(303, `/account/settings`);
      }

      authLog.step("lookup-email", { emailHash });
      const existingEmailOwner = await userGetter.byEmail(email);
      if (existingEmailOwner && existingEmailOwner.userId !== currentUser.userId) {
        outcome.status = "email-in-use";
        outcome.reason = "email-owned-by-other-user";
        authLog.log.warn({ existingUserId: existingEmailOwner.userId }, "Change email rejected: email already in use");
        await setBannerCookie(
          "danger",
          "That email is already in use by another account.",
          res
        );
        return res.redirect(303, `/account/settings`);
      }

      if (!isEmailServiceConfigured()) {
        outcome.status = "smtp-unavailable";
        outcome.reason = "email-service-missing";
        authLog.log.warn({ reason: outcome.reason }, "Change email rejected: email service unavailable");
        await setBannerCookie(
          "danger",
          "We can't send a verification email right now. Please try again later or contact an administrator.",
          res
        );
        return res.redirect(303, `/account/settings`);
      }

      const { token, tokenHash } = generateToken();
      const expiry = tokenExpiry(EMAIL_TOKEN_EXPIRY_MINUTES);

      const verifyUrl = `${process.env.siteAddress}/verify-email?token=${token}`;
      const emailLogger = authLog.log.child({ step: "send-change-email", userId: currentUser.userId });
      const emailDispatched = await dispatchEmail(
        () => sendEmailVerificationMail(email, currentUser.username, verifyUrl),
        "Change email verification dispatch failed",
        emailLogger
      );

      if (!emailDispatched) {
        outcome.status = "email-dispatch-failed";
        outcome.reason = "change-email-email-failed";
        await setBannerCookie(
          "danger",
          "We couldn't send a verification email to that address. Please try again later.",
          res
        );
        return res.redirect(303, `/account/settings`);
      }

      authLog.step("update-email", { userId: currentUser.userId });
      await updateEmail(currentUser.userId, email, tokenHash, expiry);

      req.session.user.email = email;

      outcome.status = "success";
      authLog.log.info({ userId: currentUser.userId }, "Change email verification dispatched");
      await setBannerCookie(
        "success",
        "We've sent a verification link to your new email. Please confirm it to finish updating your account.",
        res
      );
      return res.redirect(303, `/account/settings`);
    } catch (error) {
      outcome.status = "error";
      outcome.error = error.message;
      authLog.log.error({ err: error }, "Change email error");
      await setBannerCookie(
        "danger",
        "We could not update your email address right now.",
        res
      );
      return res.redirect(303, `/account/settings`);
    } finally {
      authLog.finish(outcome.status, {
        redirectTo: outcome.redirectTo,
        reason: outcome.reason,
        error: outcome.error,
      });
    }
  });

  app.post("/account/change-password", async function (req, res) {
    if (!req.session.user) {
      await setBannerCookie("warning", "Please sign in to continue.", res);
      return res.redirect(303, `/login`);
    }

    const currentPassword = req.body?.currentPassword?.trim();
    const newPassword = req.body?.newPassword?.trim();
    const confirmPassword = req.body?.confirmPassword?.trim();
    const authLog = createAuthFlowLogger(req, "web-change-password", {
      sessionUserId: req.session.user.userId,
    });
    const outcome = { status: "unknown", redirectTo: `/account/settings` };

    try {
      authLog.step("validate-input", {
        hasCurrent: Boolean(currentPassword),
        hasNew: Boolean(newPassword),
        hasConfirm: Boolean(confirmPassword),
      });
      if (!currentPassword || !newPassword || !confirmPassword) {
        outcome.status = "invalid-request";
        outcome.reason = "missing-fields";
        authLog.log.warn({ reason: outcome.reason }, "Change password rejected: missing fields");
        await setBannerCookie("warning", "All password fields are required.", res);
        return res.redirect(303, `/account/settings`);
      }

      const newPasswordValidation = validatePasswordAgainstPolicy(
        newPassword,
        passwordPolicy
      );
      if (!newPasswordValidation.valid) {
        outcome.status = "invalid-password";
        outcome.reason = newPasswordValidation.failedRules[0].key || "policy";
        authLog.log.warn({ reason: outcome.reason }, "Change password rejected: password failed policy");
        await setBannerCookie(
          "warning",
          newPasswordValidation.failedRules[0].message,
          res
        );
        return res.redirect(303, `/account/settings`);
      }

      if (newPassword !== confirmPassword) {
        outcome.status = "invalid-password";
        outcome.reason = "confirmation-mismatch";
        authLog.log.warn({ reason: outcome.reason }, "Change password rejected: confirmation mismatch");
        await setBannerCookie("warning", "New passwords do not match.", res);
        return res.redirect(303, `/account/settings`);
      }

      const userGetter = new UserGetter();
      authLog.step("lookup-user", { username: req.session.user.username });
      const currentUser = await userGetter.byUsername(req.session.user.username);

      if (!currentUser || !currentUser.password_hash) {
        outcome.status = "invalid-session";
        outcome.reason = "user-not-found";
        authLog.log.warn({ reason: outcome.reason }, "Change password rejected: session invalid");
        await setBannerCookie(
          "danger",
          "We could not validate your account. Please sign in again.",
          res
        );
        return res.redirect(303, `/login`);
      }

      const passwordMatches = await bcrypt.compare(
        currentPassword,
        currentUser.password_hash
      );

      if (!passwordMatches) {
        outcome.status = "invalid-credentials";
        outcome.reason = "password-mismatch";
        authLog.log.warn({ userId: currentUser.userId }, "Change password rejected: incorrect current password");
        await setBannerCookie("danger", "Your current password was incorrect.", res);
        return res.redirect(303, `/account/settings`);
      }

      authLog.step("update-password", { userId: currentUser.userId });
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await updatePassword(currentUser.userId, passwordHash);

      outcome.status = "success";
      authLog.log.info({ userId: currentUser.userId }, "Password updated for account");
      await setBannerCookie(
        "success",
        "Your password has been updated.",
        res
      );
      return res.redirect(303, `/account/settings`);
    } catch (error) {
      outcome.status = "error";
      outcome.error = error.message;
      authLog.log.error({ err: error }, "Change password error");
      await setBannerCookie(
        "danger",
        "We could not update your password right now.",
        res
      );
      return res.redirect(303, `/account/settings`);
    } finally {
      authLog.finish(outcome.status, {
        redirectTo: outcome.redirectTo,
        reason: outcome.reason,
        error: outcome.error,
      });
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
      return res.redirect(303, `/login`);
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
          return res.redirect(303, `/login`);
        }

        const existingOwner = await userGetter.byDiscordId(userData.id);
        if (existingOwner && existingOwner.userId !== req.session.user.userId) {
          await setBannerCookie(
            "danger",
            "That Discord account is already linked to another user.",
            res
          );
          return res.redirect(303, `/account/settings`);
        }

        await linkDiscordAccount(req.session.user.userId, userData.id);
        req.session.user.discordID = userData.id;

        await setBannerCookie(
          "success",
          "Your Discord account has been linked successfully.",
          res
        );
        return res.redirect(303, `/account/settings`);
      }

      const existingUser = await userGetter.byDiscordId(userData.id);

      if (!existingUser) {
        res.cookie("discordId", userData.id, {
          path: "/",
          httpOnly: true,
          maxAge: 600000,
        });

        console.log("User is unregistered, redirecting to /unregistered");
        return res.redirect(303, `/unregistered`);
      }

      await buildSession(req, existingUser);
      return res.redirect(303, `/`);
    } catch (error) {
      console.error("Discord login error:", error);
      await setBannerCookie(
        "danger",
        "We could not complete the Discord sign in.",
        res
      );
      return res.redirect(303, `/login`);
    }
  });

  app.get("/unregistered", async function (req, res) {
    if (!isFeatureWebRouteEnabled(features.web.register, req, res, features))
      return;

    const discordId = req.cookies.discordId;
    if (!discordId) return res.redirect(303, `/`);

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
      res.redirect(303, `/`);
    } catch (err) {
      console.log(err);
      throw err;
    }
  });
}
