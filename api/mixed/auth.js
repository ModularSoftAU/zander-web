/**
 * api/mixed/auth.js
 *
 * Authentication helpers for the Mixed API surface.
 *
 *   requirePluginToken       — Bearer-token auth for zander-pgm ingestion endpoints.
 *   requireLinkedUser        — session user with a linked Minecraft account (uuid).
 *   requireLinkedUserOrPlugin — session user OR zander-pgm plugin token (for routes
 *                               that accept both web submissions and in-game
 *                               submissions relayed by the plugin, e.g. /vote and
 *                               /maprate). When authorised via the plugin token,
 *                               the player identity is taken from the request body
 *                               (the plugin already knows the acting player) rather
 *                               than from a session.
 *   requireMixedAdmin        — session user with the zander.web.mixed capability.
 *
 * The plugin authenticates with the same app-wide process.env.apiKey used by
 * every other internal API integration (see api/common.js) — there is no
 * separate Mixed-specific plugin token. It is never exposed to the frontend.
 * The Stripe secret key is never read here.
 */

const ADMIN_NODES = ["zander.web.mixed", "zander.web.*", "*"];

/**
 * Check whether a request carries the app-wide API key, without sending any
 * response. Prefers Authorization: Bearer <token>, but also accepts the
 * legacy x-access-token header used elsewhere in this codebase.
 */
function hasValidPluginToken(req) {
  const expected = process.env.apiKey;
  if (!expected) return false;

  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const legacyToken = typeof req.headers["x-access-token"] === "string"
    ? req.headers["x-access-token"].trim()
    : null;
  const token = bearerToken || legacyToken;

  return token === expected;
}

/**
 * Verify the plugin request carries the app-wide API key.
 * Returns true when authorised; otherwise sends a 401/503 and returns false.
 */
export function requirePluginToken(req, res) {
  if (!process.env.apiKey) {
    console.error("[mixed:auth] No API key (apiKey) is configured.");
    res.status(503).send({ success: false, message: "Mixed plugin API is not configured." });
    return false;
  }

  if (!hasValidPluginToken(req)) {
    const authHeader = req.headers["authorization"] || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    const legacyToken = typeof req.headers["x-access-token"] === "string"
      ? req.headers["x-access-token"].trim()
      : null;
    const source = req.headers["x-server-id"] || req.ip || "unknown";
    const presentedHeader = bearerToken
      ? "authorization-bearer"
      : legacyToken
        ? "x-access-token"
        : authHeader
          ? "authorization-non-bearer"
          : "none";
    console.warn(
      `[mixed:auth] Rejected ingestion request from ${source}: invalid or missing API key (header=${presentedHeader}).`
    );
    res.status(401).send({ success: false, message: "Invalid or missing API key." });
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

/**
 * Require either a linked web session OR a valid plugin request. Used by
 * routes that accept both a browser-submitted vote/rating (session, identity
 * from req.session.user) and an in-game one relayed by zander-pgm (API key,
 * identity taken from the request body since the plugin already knows the
 * acting player).
 *
 * Returns { uuid, username, source: "web" | "plugin" } when authorised,
 * otherwise sends an error response and returns null.
 */
export function requireLinkedUserOrPlugin(req, res) {
  if (hasValidPluginToken(req)) {
    const uuid = req.body?.uuid;
    const username = req.body?.username;
    if (!uuid || !username) {
      res.status(400).send({ success: false, message: "uuid and username are required." });
      return null;
    }
    return { uuid, username, source: "plugin" };
  }

  const user = requireLinkedUser(req, res);
  if (!user) return null;
  return { uuid: user.uuid, username: user.username, source: "web" };
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
