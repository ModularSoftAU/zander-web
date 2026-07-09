/**
 * api/mixed/auth.js
 *
 * Authentication helpers for the Mixed API surface.
 *
 *   requirePluginToken   — Bearer-token auth for zander-pgm ingestion endpoints.
 *   requireLinkedUser    — session user with a linked Minecraft account (uuid).
 *   requireMixedAdmin    — session user with the zander.web.mixed capability.
 *
 * The plugin API token lives in process.env.MIXED_PLUGIN_API_TOKEN. For
 * operational convenience, the app-wide process.env.apiKey is also accepted
 * for ingestion requests when present. Neither value is exposed to the
 * frontend. The Stripe secret key is never read here.
 */

const ADMIN_NODES = ["zander.web.mixed", "zander.web.*", "*"];

/**
 * Verify the plugin ingestion token.
 * Prefer Authorization: Bearer <token>, but also accept the legacy
 * x-access-token header so older plugin builds can continue to ingest while
 * deployments catch up.
 * Returns true when authorised; otherwise sends a 401 and returns false.
 */
export function requirePluginToken(req, res) {
  const acceptedTokens = [
    process.env.MIXED_PLUGIN_API_TOKEN,
    process.env.apiKey,
  ].filter((value, index, arr) => value && arr.indexOf(value) === index);

  if (!acceptedTokens.length) {
    console.error("[mixed:auth] No plugin ingestion token is configured.");
    res.status(503).send({ success: false, message: "Mixed plugin API is not configured." });
    return false;
  }

  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const legacyToken = typeof req.headers["x-access-token"] === "string"
    ? req.headers["x-access-token"].trim()
    : null;
  const token = bearerToken || legacyToken;

  if (!token || !acceptedTokens.includes(token)) {
    const source = req.headers["x-server-id"] || req.ip || "unknown";
    const presentedHeader = bearerToken
      ? "authorization-bearer"
      : legacyToken
        ? "x-access-token"
        : authHeader
          ? "authorization-non-bearer"
          : "none";
    console.warn(
      `[mixed:auth] Rejected ingestion request from ${source}: invalid or missing plugin token (header=${presentedHeader}).`
    );
    res.status(401).send({ success: false, message: "Invalid or missing plugin API token." });
    return false;
  }

  return true;
}

/**
 * Require a logged-in user with a linked Minecraft account.
 * Returns the user object when authorised, otherwise sends an error and null.
 */
export function requireLinkedUser(req, res) {
  const user = req.session?.user;
  if (!user) {
    res.status(401).send({ success: false, message: "You must be logged in." });
    return null;
  }
  if (!user.uuid) {
    res.status(403).send({
      success: false,
      message: "You must link your Minecraft account before using this feature.",
    });
    return null;
  }
  return user;
}

/** True if the session user holds the Mixed admin capability. */
export function isMixedAdmin(req) {
  const perms = req.session?.user?.permissions;
  if (!Array.isArray(perms)) return false;
  const lower = perms.map((p) => String(p).trim().toLowerCase());
  return ADMIN_NODES.some((n) => lower.includes(n)) ||
    lower.some((p) => p.endsWith(".*") && "zander.web.mixed".startsWith(p.slice(0, -1)));
}

export function requireMixedAdmin(req, res) {
  if (!isMixedAdmin(req)) {
    res.status(403).send({ success: false, message: "Admin access required." });
    return false;
  }
  return true;
}
