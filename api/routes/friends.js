/**
 * api/routes/friends.js
 *
 * Token API for the proxy. Registered from api/routes/index.js, so it inherits
 * x-access-token auth from the verifyToken plugin scope — no auth wrapper here.
 *
 * Shape matches POST /api/user/create: the actor is identified by UUID in the
 * body/query, responses are { success, message, data? }, fields via
 * required()/optional().
 *
 * All traffic arrives from one machine, so the request-IP rate limiter is
 * bypassed; limiting is keyed on the ACTOR UUID instead (10 friend requests/hr,
 * 30 blocks/day). /api/friends/online reuses the hidden-session filter so vanish
 * is respected.
 */

import { required, optional } from "../common.js";
import {
  FriendActionError,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getFriends,
  getBlocks,
  getPendingIncoming,
  getPendingOutgoing,
  getUndeliveredRequests,
  markRequestsDelivered,
  getOnlineFriends,
  getPrivacySettings,
  setPrivacySettings,
} from "../../controllers/friendController.js";

// --- actor-UUID rate limiting -------------------------------------------
const actorBuckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of actorBuckets) if (now > b.resetAt) actorBuckets.delete(k);
}, 60_000).unref?.();

function limitByActor(uuid, res, { key, windowMs, max }) {
  const now = Date.now();
  const k = `${key}:${uuid}`;
  let b = actorBuckets.get(k);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    actorBuckets.set(k, b);
  }
  b.count += 1;
  if (b.count > max) {
    res.status(429).send({
      success: false,
      message: "Rate limit exceeded. Try again later.",
    });
    return false;
  }
  return true;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export default function friendsApiRoute(app, config, db, features, lang) {
  const enabled = () => features.friends !== false;

  function featureGuard(res) {
    if (enabled()) return true;
    res.status(404).send({ success: false, message: "Friends feature is disabled." });
    return false;
  }

  function lookupByUuid(uuid) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT userId, username, is_placeholder, account_disabled FROM users WHERE uuid = ? LIMIT 1`,
        [uuid],
        (err, rows) => (err ? reject(err) : resolve(rows?.[0] || null))
      );
    });
  }

  function lookupByName(name) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT userId, username, is_placeholder, account_disabled FROM users WHERE username = ? LIMIT 1`,
        [name],
        (err, rows) => (err ? reject(err) : resolve(rows?.[0] || null))
      );
    });
  }

  /**
   * Resolve { uuid, targetName } to { actor, target } rows, sending the
   * appropriate { success:false } response and returning null on any problem.
   * Self-action is rejected by BOTH resolved id and name (the name check catches
   * nickname cases the id check can miss).
   */
  async function resolveActorAndTarget(uuid, targetName, res) {
    const actor = await lookupByUuid(uuid);
    if (!actor) {
      res.send({ success: false, message: "Unknown actor UUID." });
      return null;
    }
    const target = await lookupByName(targetName);
    if (!target) {
      res.send({ success: false, message: `No player named '${targetName}'.` });
      return null;
    }
    if (
      target.userId === actor.userId ||
      String(target.username).toLowerCase() === String(actor.username).toLowerCase() ||
      String(targetName).toLowerCase() === String(actor.username).toLowerCase()
    ) {
      res.send({ success: false, message: "You cannot do that to yourself." });
      return null;
    }
    return { actor, target };
  }

  const fail = (res, err, fallback) => {
    if (err instanceof FriendActionError) {
      return res.send({ success: false, message: err.message });
    }
    console.error("[api:friends]", err);
    return res.status(500).send({ success: false, message: fallback });
  };

  // ---------------------------------------------------------------------
  // Friend requests
  // ---------------------------------------------------------------------

  app.post("/api/friends/request", async function (req, res) {
    if (!featureGuard(res)) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const targetName = required(req.body, "targetName", res);
    if (res.sent) return;
    if (!limitByActor(uuid, res, { key: "friend_request", windowMs: HOUR, max: 10 })) return;

    try {
      const pair = await resolveActorAndTarget(uuid, targetName, res);
      if (!pair) return;
      const result = await sendFriendRequest(pair.actor.userId, pair.target.userId, {
        source: "game",
        message: optional(req.body, "message"),
      });
      return res.send({
        success: true,
        message:
          result.status === "accepted"
            ? `You are now friends with ${pair.target.username}.`
            : "Friend request sent.",
        data: { status: result.status },
      });
    } catch (err) {
      return fail(res, err, "Could not send that friend request.");
    }
  });

  app.post("/api/friends/accept", async function (req, res) {
    if (!featureGuard(res)) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const targetName = required(req.body, "targetName", res);
    if (res.sent) return;

    try {
      const pair = await resolveActorAndTarget(uuid, targetName, res);
      if (!pair) return;
      const { ok } = await acceptFriendRequest(pair.actor.userId, pair.target.userId);
      return res.send({
        success: ok,
        message: ok
          ? `You are now friends with ${pair.target.username}.`
          : "No pending request from that player.",
      });
    } catch (err) {
      return fail(res, err, "Could not accept that request.");
    }
  });

  app.post("/api/friends/decline", async function (req, res) {
    if (!featureGuard(res)) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const targetName = required(req.body, "targetName", res);
    if (res.sent) return;

    try {
      const pair = await resolveActorAndTarget(uuid, targetName, res);
      if (!pair) return;
      const { ok } = await declineFriendRequest(pair.actor.userId, pair.target.userId);
      return res.send({
        success: ok,
        message: ok ? "Friend request declined." : "No pending request from that player.",
      });
    } catch (err) {
      return fail(res, err, "Could not decline that request.");
    }
  });

  app.post("/api/friends/remove", async function (req, res) {
    if (!featureGuard(res)) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const targetName = required(req.body, "targetName", res);
    if (res.sent) return;

    try {
      const pair = await resolveActorAndTarget(uuid, targetName, res);
      if (!pair) return;
      await removeFriend(pair.actor.userId, pair.target.userId);
      return res.send({ success: true, message: `Removed ${pair.target.username}.` });
    } catch (err) {
      return fail(res, err, "Could not update your friends list.");
    }
  });

  // ---------------------------------------------------------------------
  // Friend reads
  // ---------------------------------------------------------------------

  async function actorIdFromQuery(req, res) {
    const uuid = required(req.query, "uuid", res);
    if (res.sent) return null;
    const actor = await lookupByUuid(uuid);
    if (!actor) {
      res.send({ success: false, message: "Unknown actor UUID." });
      return null;
    }
    return actor.userId;
  }

  app.get("/api/friends/list", async function (req, res) {
    if (!featureGuard(res)) return;
    try {
      const actorId = await actorIdFromQuery(req, res);
      if (actorId == null) return;
      const friends = await getFriends(actorId, { viewerId: actorId });
      return res.send({
        success: true,
        data: friends.map((f) => ({ userId: f.userId, username: f.username, uuid: f.uuid })),
      });
    } catch (err) {
      return fail(res, err, "Could not load friends.");
    }
  });

  app.get("/api/friends/pending", async function (req, res) {
    if (!featureGuard(res)) return;
    try {
      const actorId = await actorIdFromQuery(req, res);
      if (actorId == null) return;
      const [incoming, outgoing] = await Promise.all([
        getPendingIncoming(actorId),
        getPendingOutgoing(actorId),
      ]);
      return res.send({
        success: true,
        data: {
          incoming: incoming.map((r) => ({ username: r.username, message: r.message })),
          outgoing: outgoing.map((r) => ({ username: r.username })),
        },
      });
    } catch (err) {
      return fail(res, err, "Could not load pending requests.");
    }
  });

  app.post("/api/friends/delivered", async function (req, res) {
    if (!featureGuard(res)) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    try {
      const actor = await lookupByUuid(uuid);
      if (!actor) return res.send({ success: false, message: "Unknown actor UUID." });
      const undelivered = await getUndeliveredRequests(actor.userId);
      const count = await markRequestsDelivered(actor.userId);
      return res.send({
        success: true,
        message: `${count} request(s) marked delivered.`,
        data: {
          delivered: undelivered.map((r) => ({
            username: r.username,
            message: r.message,
          })),
        },
      });
    } catch (err) {
      return fail(res, err, "Could not mark requests delivered.");
    }
  });

  app.get("/api/friends/online", async function (req, res) {
    if (!featureGuard(res)) return;
    try {
      const actorId = await actorIdFromQuery(req, res);
      if (actorId == null) return;
      const online = await getOnlineFriends(actorId);
      return res.send({
        success: true,
        data: online.map((f) => ({
          username: f.username,
          uuid: f.uuid,
          server: f.server || null,
        })),
      });
    } catch (err) {
      return fail(res, err, "Could not load online friends.");
    }
  });

  // ---------------------------------------------------------------------
  // Blocks
  // ---------------------------------------------------------------------

  app.post("/api/blocks/add", async function (req, res) {
    if (!featureGuard(res)) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const targetName = required(req.body, "targetName", res);
    if (res.sent) return;
    if (!limitByActor(uuid, res, { key: "block_add", windowMs: DAY, max: 30 })) return;

    try {
      const pair = await resolveActorAndTarget(uuid, targetName, res);
      if (!pair) return;
      await blockUser(pair.actor.userId, pair.target.userId, {
        source: "game",
        reason: optional(req.body, "reason"),
      });
      return res.send({ success: true, message: `You have blocked ${pair.target.username}.` });
    } catch (err) {
      return fail(res, err, "Could not block that player.");
    }
  });

  app.post("/api/blocks/remove", async function (req, res) {
    if (!featureGuard(res)) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;
    const targetName = required(req.body, "targetName", res);
    if (res.sent) return;

    try {
      const pair = await resolveActorAndTarget(uuid, targetName, res);
      if (!pair) return;
      await unblockUser(pair.actor.userId, pair.target.userId);
      return res.send({ success: true, message: `You have unblocked ${pair.target.username}.` });
    } catch (err) {
      return fail(res, err, "Could not unblock that player.");
    }
  });

  app.get("/api/blocks/list", async function (req, res) {
    if (!featureGuard(res)) return;
    try {
      const actorId = await actorIdFromQuery(req, res);
      if (actorId == null) return;
      const blocks = await getBlocks(actorId);
      return res.send({
        success: true,
        data: blocks.map((b) => ({ username: b.username, uuid: b.uuid })),
      });
    } catch (err) {
      return fail(res, err, "Could not load blocks.");
    }
  });

  // ---------------------------------------------------------------------
  // Privacy settings
  // ---------------------------------------------------------------------

  app.get("/api/settings", async function (req, res) {
    if (!featureGuard(res)) return;
    try {
      const actorId = await actorIdFromQuery(req, res);
      if (actorId == null) return;
      const settings = await getPrivacySettings(actorId);
      return res.send({ success: true, data: settings });
    } catch (err) {
      return fail(res, err, "Could not load settings.");
    }
  });

  app.patch("/api/settings", async function (req, res) {
    if (!featureGuard(res)) return;
    const uuid = required(req.body, "uuid", res);
    if (res.sent) return;

    try {
      const actor = await lookupByUuid(uuid);
      if (!actor) return res.send({ success: false, message: "Unknown actor UUID." });

      const patch = {};
      for (const key of ["allowMessagesFrom", "allowFriendRequests"]) {
        const v = optional(req.body, key);
        if (v != null) patch[key] = String(v);
      }
      for (const key of ["friendsListVisible", "notifyFriendJoin", "notifyFriendRequest"]) {
        const v = optional(req.body, key);
        if (v != null) patch[key] = v === true || v === 1 || v === "1" || v === "true";
      }

      const settings = await setPrivacySettings(actor.userId, patch);
      return res.send({ success: true, message: "Settings updated.", data: settings });
    } catch (err) {
      return fail(res, err, "Could not update settings.");
    }
  });
}
