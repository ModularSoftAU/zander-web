/**
 * controllers/friendController.js
 *
 * Data-access layer for the friends system: friendships (mutual), blocks
 * (one-directional), and privacy settings. Raw SQL over the mysql2 pool, styled
 * after controllers/userController.js.
 *
 * `sendFriendRequest` and `blockUser` are the ONLY write paths for their
 * relationships — the website routes and the token API for the proxy both call
 * straight through here so the two entry points can never diverge.
 *
 * Rules that live here rather than at the route layer:
 *   - Block precedence: a block always wins. It deletes any friendship, cancels
 *     pending requests both ways, and bars new requests in either direction
 *     while it stands. Blocked players are never told — a blocked request
 *     returns the same benign response an ordinary declined one would.
 *   - Self-actions are rejected (by id here; callers also check by name because
 *     the name check catches nickname cases the id check misses).
 *   - Placeholder / disabled accounts are not valid friend or request targets.
 *   - One high unadvertised friend ceiling for everyone, logged not surfaced.
 *     Pending outgoing requests are capped at 20 (real anti-spam, surfaceable).
 *   - Block add/remove is written to the audit log (`logs`).
 */

import db from "./databaseController.js";

/**
 * Abuse backstop. Not a rank perk — the same for everyone. No legitimate player
 * reaches this, so hitting it is logged rather than surfaced as an error.
 */
export const FRIEND_CEILING = 5000;

/** Pending outgoing requests per user. This one is real anti-spam and surfaceable. */
export const PENDING_OUTGOING_CAP = 20;

/** A declined request can be re-sent once this many hours have passed. */
export const DECLINE_COOLDOWN_HOURS = 24;

const PRIVACY_DEFAULTS = {
  allowMessagesFrom: "everyone",
  allowFriendRequests: "everyone",
  friendsListVisible: true,
  notifyFriendJoin: true,
  notifyFriendRequest: true,
};

const MESSAGE_ENUM = ["everyone", "friends", "none"];

/**
 * Surfaceable failure — the caller may show `message` to the actor as-is. Used
 * for genuine, non-leaking errors (self-action, outgoing cap, invalid target).
 * Block / privacy / cooldown outcomes never throw this; they return a benign
 * "declined" result so a blocked party cannot infer the block.
 */
export class FriendActionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "FriendActionError";
    this.code = code;
  }
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function loadUserRow(userId) {
  const rows = await runQuery(
    `SELECT userId, username, is_placeholder, account_disabled FROM users WHERE userId = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

function isValidTarget(row) {
  return !!row && !row.is_placeholder && !row.account_disabled;
}

// ---------------------------------------------------------------------------
// Friendships — reads
// ---------------------------------------------------------------------------

/**
 * Accepted friends of `userId`. When `viewerId` is supplied, anyone in a block
 * relationship with the viewer (either direction) is filtered out.
 */
export async function getFriends(userId, { viewerId = null } = {}) {
  const id = toId(userId);
  if (!id) return [];

  const rows = await runQuery(
    `SELECT u.userId, u.username, u.uuid,
            u.profilePicture_type, u.profilePicture_email,
            f.friendshipId, f.requestedAt, f.respondedAt
       FROM userFriendships f
       JOIN users u
         ON u.userId = CASE WHEN f.requesterId = ? THEN f.addresseeId ELSE f.requesterId END
      WHERE f.status = 'accepted'
        AND (f.requesterId = ? OR f.addresseeId = ?)
      ORDER BY u.username ASC`,
    [id, id, id]
  );

  const viewer = toId(viewerId);
  if (!viewer) return rows;

  const blockRows = await runQuery(
    `SELECT blockerId, blockedId FROM userBlocks WHERE blockerId = ? OR blockedId = ?`,
    [viewer, viewer]
  );
  const hidden = new Set(
    blockRows.map((b) => (b.blockerId === viewer ? b.blockedId : b.blockerId))
  );
  return rows.filter((r) => !hidden.has(r.userId));
}

export async function getFriendCount(userId) {
  const id = toId(userId);
  if (!id) return 0;
  const rows = await runQuery(
    `SELECT COUNT(*) AS c FROM userFriendships
      WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?)`,
    [id, id]
  );
  return rows[0]?.c ?? 0;
}

/**
 * Mutual friends of `viewerId` and `ownerId`. One query does the intersection in
 * SQL; JS only takes the length and the avatar slice. Anyone in a block
 * relationship with the VIEWER is excluded, so the count can legitimately differ
 * from what a third party sees.
 *
 * Callers own the disclosure rules (hidden list -> show nothing, either party
 * blocked -> show nothing, zero -> render nothing).
 */
export async function getMutualFriends(viewerId, ownerId, { limit = 12 } = {}) {
  const viewer = toId(viewerId);
  const owner = toId(ownerId);
  if (!viewer || !owner || viewer === owner) return { total: 0, friends: [] };

  const rows = await runQuery(
    `SELECT u.userId, u.username, u.uuid,
            u.profilePicture_type, u.profilePicture_email
       FROM users u
      WHERE u.userId IN (
              SELECT CASE WHEN requesterId = ? THEN addresseeId ELSE requesterId END
                FROM userFriendships
               WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?))
        AND u.userId IN (
              SELECT CASE WHEN requesterId = ? THEN addresseeId ELSE requesterId END
                FROM userFriendships
               WHERE status = 'accepted' AND (requesterId = ? OR addresseeId = ?))
        AND u.userId NOT IN (
              SELECT CASE WHEN blockerId = ? THEN blockedId ELSE blockerId END
                FROM userBlocks
               WHERE blockerId = ? OR blockedId = ?)
      ORDER BY u.username ASC`,
    [viewer, viewer, viewer, owner, owner, owner, viewer, viewer, viewer]
  );

  return { total: rows.length, friends: rows.slice(0, Math.max(0, limit)) };
}

export async function getPendingIncoming(userId) {
  const id = toId(userId);
  if (!id) return [];
  return runQuery(
    `SELECT f.friendshipId, f.requesterId, f.message, f.source, f.requestedAt,
            u.username, u.uuid, u.profilePicture_type, u.profilePicture_email
       FROM userFriendships f
       JOIN users u ON u.userId = f.requesterId
      WHERE f.addresseeId = ? AND f.status = 'pending'
      ORDER BY f.requestedAt DESC`,
    [id]
  );
}

export async function getPendingOutgoing(userId) {
  const id = toId(userId);
  if (!id) return [];
  return runQuery(
    `SELECT f.friendshipId, f.addresseeId, f.message, f.source, f.requestedAt,
            u.username, u.uuid, u.profilePicture_type, u.profilePicture_email
       FROM userFriendships f
       JOIN users u ON u.userId = f.addresseeId
      WHERE f.requesterId = ? AND f.status = 'pending'
      ORDER BY f.requestedAt DESC`,
    [id]
  );
}

/**
 * Accepted friends of `userId` who currently have an open, NON-hidden game
 * session — i.e. genuinely online and not vanished. Reuses the same
 * sessionEnd/hidden/staleness predicates as getUserLastSession so a vanished
 * friend is indistinguishable from an offline one.
 */
export async function getOnlineFriends(userId) {
  const id = toId(userId);
  if (!id) return [];
  return runQuery(
    `SELECT u.userId, u.username, u.uuid, MAX(gs.server) AS server
       FROM userFriendships f
       JOIN users u
         ON u.userId = CASE WHEN f.requesterId = ? THEN f.addresseeId ELSE f.requesterId END
       JOIN gameSessions gs ON gs.userId = u.userId
      WHERE f.status = 'accepted'
        AND (f.requesterId = ? OR f.addresseeId = ?)
        AND gs.sessionEnd IS NULL
        AND gs.hidden = 0
        AND gs.sessionStart >= (NOW() - INTERVAL 24 HOUR)
      GROUP BY u.userId, u.username, u.uuid
      ORDER BY u.username ASC`,
    [id, id, id]
  );
}

export async function getUndeliveredRequests(userId) {
  const id = toId(userId);
  if (!id) return [];
  return runQuery(
    `SELECT f.friendshipId, f.requesterId, f.message, f.source, f.requestedAt,
            u.username, u.uuid
       FROM userFriendships f
       JOIN users u ON u.userId = f.requesterId
      WHERE f.addresseeId = ? AND f.status = 'pending' AND f.deliveredAt IS NULL
      ORDER BY f.requestedAt ASC`,
    [id]
  );
}

export async function markRequestsDelivered(userId) {
  const id = toId(userId);
  if (!id) return 0;
  const res = await runQuery(
    `UPDATE userFriendships SET deliveredAt = NOW()
      WHERE addresseeId = ? AND status = 'pending' AND deliveredAt IS NULL`,
    [id]
  );
  return res?.affectedRows ?? 0;
}

export async function areFriends(userIdA, userIdB) {
  const a = toId(userIdA);
  const b = toId(userIdB);
  if (!a || !b || a === b) return false;
  const rows = await runQuery(
    `SELECT 1 FROM userFriendships
      WHERE status = 'accepted'
        AND ((requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?))
      LIMIT 1`,
    [a, b, b, a]
  );
  return rows.length > 0;
}

/**
 * The viewer/owner relationship in one round-trip. Never exposes block reasons.
 */
export async function getRelationship(viewerId, ownerId) {
  const viewer = toId(viewerId);
  const owner = toId(ownerId);

  const empty = {
    isSelf: false,
    isFriend: false,
    pendingIncoming: false,
    pendingOutgoing: false,
    blockedByMe: false,
    blockedMe: false,
  };

  if (!viewer || !owner) return empty;
  if (viewer === owner) return { ...empty, isSelf: true };

  const [friendRows, blockRows] = await Promise.all([
    runQuery(
      `SELECT requesterId, addresseeId, status FROM userFriendships
        WHERE (requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?)`,
      [viewer, owner, owner, viewer]
    ),
    runQuery(
      `SELECT blockerId, blockedId FROM userBlocks
        WHERE (blockerId = ? AND blockedId = ?) OR (blockerId = ? AND blockedId = ?)`,
      [viewer, owner, owner, viewer]
    ),
  ]);

  const rel = { ...empty };
  for (const f of friendRows) {
    if (f.status === "accepted") rel.isFriend = true;
    else if (f.status === "pending") {
      if (f.requesterId === owner) rel.pendingIncoming = true;
      else rel.pendingOutgoing = true;
    }
  }
  rel.blockedByMe = blockRows.some((b) => b.blockerId === viewer);
  rel.blockedMe = blockRows.some((b) => b.blockerId === owner);
  return rel;
}

// ---------------------------------------------------------------------------
// Friendships — the single write path
// ---------------------------------------------------------------------------

/** A benign outcome a blocked / unwilling target's requester cannot distinguish. */
function declinedResult() {
  return { status: "declined" };
}

/**
 * The ONLY way a friendship row is created. Resolves a mutual pending request as
 * an accept rather than writing a second row.
 *
 * Returns { status: 'pending' | 'accepted' | 'declined', friendshipId? }.
 * 'declined' is deliberately indistinguishable between "blocked", "privacy
 * disallows" and "still in decline cooldown".
 */
export async function sendFriendRequest(
  requesterId,
  addresseeId,
  { source = "web", message = null } = {}
) {
  const requester = toId(requesterId);
  const addressee = toId(addresseeId);

  if (!requester || !addressee) {
    throw new FriendActionError("That player could not be found.", "invalid_target");
  }
  if (requester === addressee) {
    throw new FriendActionError(
      "You cannot send yourself a friend request.",
      "self"
    );
  }

  const addresseeRow = await loadUserRow(addressee);
  if (!isValidTarget(addresseeRow)) {
    throw new FriendActionError(
      "That player cannot receive friend requests.",
      "invalid_target"
    );
  }

  // Block precedence: a block in either direction fails silently.
  if (await isBlockedEitherWay(requester, addressee)) {
    return declinedResult();
  }

  // Target privacy — same benign outcome as a block.
  const settings = await getPrivacySettings(addressee);
  if (settings.allowFriendRequests === "none") {
    return declinedResult();
  }
  if (
    settings.allowFriendRequests === "friends" &&
    !(await areFriends(requester, addressee))
  ) {
    return declinedResult();
  }

  const cleanMessage =
    typeof message === "string" && message.trim()
      ? message.trim().slice(0, 140)
      : null;

  // Reverse pair: if the addressee already asked us, this is an accept.
  const reverse = await runQuery(
    `SELECT friendshipId, status, respondedAt FROM userFriendships
      WHERE requesterId = ? AND addresseeId = ? LIMIT 1`,
    [addressee, requester]
  );
  if (reverse.length) {
    const row = reverse[0];
    if (row.status === "accepted") return { status: "accepted", friendshipId: row.friendshipId };
    if (row.status === "pending") {
      await runQuery(
        `UPDATE userFriendships SET status = 'accepted', respondedAt = NOW()
          WHERE friendshipId = ? AND status = 'pending'`,
        [row.friendshipId]
      );
      return { status: "accepted", friendshipId: row.friendshipId };
    }
    // reverse row is 'declined' (they asked us once, we declined) — no bar on us
    // asking them now; fall through to the forward-row handling.
  }

  // Forward pair.
  const forward = await runQuery(
    `SELECT friendshipId, status, respondedAt FROM userFriendships
      WHERE requesterId = ? AND addresseeId = ? LIMIT 1`,
    [requester, addressee]
  );

  if (forward.length) {
    const row = forward[0];
    if (row.status === "accepted") return { status: "accepted", friendshipId: row.friendshipId };
    if (row.status === "pending") return { status: "pending", friendshipId: row.friendshipId };

    // declined: retained for spam control, but not a permanent bar.
    const respondedAt = row.respondedAt ? new Date(row.respondedAt) : null;
    const cooledDown =
      !respondedAt ||
      Date.now() - respondedAt.getTime() >= DECLINE_COOLDOWN_HOURS * 3600 * 1000;
    if (!cooledDown) {
      // Still in cooldown — benign, indistinguishable from a block.
      return declinedResult();
    }

    await enforceCaps(requester, addressee);
    await runQuery(
      `UPDATE userFriendships
          SET status = 'pending', source = ?, message = ?,
              requestedAt = NOW(), respondedAt = NULL, deliveredAt = NULL
        WHERE friendshipId = ? AND status = 'declined'`,
      [normaliseSource(source), cleanMessage, row.friendshipId]
    );
    return { status: "pending", friendshipId: row.friendshipId };
  }

  // Brand new request.
  const capped = await enforceCaps(requester, addressee);
  if (capped) return declinedResult();

  try {
    const res = await runQuery(
      `INSERT INTO userFriendships (requesterId, addresseeId, status, source, message)
       VALUES (?, ?, 'pending', ?, ?)`,
      [requester, addressee, normaliseSource(source), cleanMessage]
    );
    return { status: "pending", friendshipId: res?.insertId };
  } catch (err) {
    // Lost an insert race on the unique (requesterId, addresseeId) pair.
    if (err && err.code === "ER_DUP_ENTRY") {
      return { status: "pending" };
    }
    throw err;
  }
}

function normaliseSource(source) {
  return ["web", "game", "discord"].includes(source) ? source : "web";
}

/**
 * @returns {boolean} true when the friend ceiling was hit (caller should return
 *   a benign result). Throws FriendActionError for the surfaceable outgoing cap.
 */
async function enforceCaps(requesterId, addresseeId) {
  const outgoing = await runQuery(
    `SELECT COUNT(*) AS c FROM userFriendships
      WHERE requesterId = ? AND status = 'pending'`,
    [requesterId]
  );
  if ((outgoing[0]?.c ?? 0) >= PENDING_OUTGOING_CAP) {
    throw new FriendActionError(
      "You have too many pending friend requests. Respond to some before sending more.",
      "outgoing_cap"
    );
  }

  for (const id of [requesterId, addresseeId]) {
    const count = await getFriendCount(id);
    if (count >= FRIEND_CEILING) {
      console.warn(
        `[friends] friend ceiling (${FRIEND_CEILING}) reached by user ${id}; request from ${requesterId} to ${addresseeId} silently dropped`
      );
      return true;
    }
  }
  return false;
}

export async function acceptFriendRequest(addresseeId, requesterId) {
  const addressee = toId(addresseeId);
  const requester = toId(requesterId);
  if (!addressee || !requester) return { ok: false };
  const res = await runQuery(
    `UPDATE userFriendships SET status = 'accepted', respondedAt = NOW()
      WHERE requesterId = ? AND addresseeId = ? AND status = 'pending'`,
    [requester, addressee]
  );
  return { ok: (res?.affectedRows ?? 0) > 0 };
}

export async function declineFriendRequest(addresseeId, requesterId) {
  const addressee = toId(addresseeId);
  const requester = toId(requesterId);
  if (!addressee || !requester) return { ok: false };
  const res = await runQuery(
    `UPDATE userFriendships SET status = 'declined', respondedAt = NOW()
      WHERE requesterId = ? AND addresseeId = ? AND status = 'pending'`,
    [requester, addressee]
  );
  return { ok: (res?.affectedRows ?? 0) > 0 };
}

/**
 * Remove a friend (or cancel an outgoing pending request). Deletes the row — no
 * tombstone, so re-adding works. Declined rows and incoming pending requests are
 * left alone (use declineFriendRequest for the latter).
 */
export async function removeFriend(userId, otherUserId) {
  const a = toId(userId);
  const b = toId(otherUserId);
  if (!a || !b) return { ok: false };
  const res = await runQuery(
    `DELETE FROM userFriendships
      WHERE ((requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?))
        AND (status = 'accepted' OR (status = 'pending' AND requesterId = ?))`,
    [a, b, b, a, a]
  );
  return { ok: (res?.affectedRows ?? 0) > 0 };
}

// ---------------------------------------------------------------------------
// Blocks — the single write path
// ---------------------------------------------------------------------------

export async function isBlockedEitherWay(userIdA, userIdB) {
  const a = toId(userIdA);
  const b = toId(userIdB);
  if (!a || !b || a === b) return false;
  const rows = await runQuery(
    `SELECT 1 FROM userBlocks
      WHERE (blockerId = ? AND blockedId = ?) OR (blockerId = ? AND blockedId = ?)
      LIMIT 1`,
    [a, b, b, a]
  );
  return rows.length > 0;
}

/**
 * The ONLY way a block is created. A block always wins: it deletes any
 * friendship, cancels pending requests both ways, and (via isBlockedEitherWay)
 * bars new requests in either direction while it stands. Written to the audit
 * log. The blocked party is never notified.
 */
export async function blockUser(
  blockerId,
  blockedId,
  { source = "web", reason = null } = {}
) {
  const blocker = toId(blockerId);
  const blocked = toId(blockedId);

  if (!blocker || !blocked) {
    throw new FriendActionError("That player could not be found.", "invalid_target");
  }
  if (blocker === blocked) {
    throw new FriendActionError("You cannot block yourself.", "self");
  }

  const blockedRow = await loadUserRow(blocked);
  if (!blockedRow) {
    throw new FriendActionError("That player could not be found.", "invalid_target");
  }

  const cleanReason =
    typeof reason === "string" && reason.trim()
      ? reason.trim().slice(0, 255)
      : null;
  const blockSource = source === "game" ? "game" : "web";

  const res = await runQuery(
    `INSERT INTO userBlocks (blockerId, blockedId, source, reason)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE source = VALUES(source), reason = VALUES(reason)`,
    [blocker, blocked, blockSource, cleanReason]
  );
  const created = (res?.affectedRows ?? 0) === 1;

  // Block precedence cascade: one statement deletes the friendship and cancels
  // any pending request in either direction.
  await runQuery(
    `DELETE FROM userFriendships
      WHERE (requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?)`,
    [blocker, blocked, blocked, blocker]
  );

  await writeBlockAudit(blocker, blocked, "add", blockSource);

  return { ok: true, created };
}

export async function unblockUser(blockerId, blockedId) {
  const blocker = toId(blockerId);
  const blocked = toId(blockedId);
  if (!blocker || !blocked) return { ok: false };

  const res = await runQuery(
    `DELETE FROM userBlocks WHERE blockerId = ? AND blockedId = ?`,
    [blocker, blocked]
  );
  const removed = (res?.affectedRows ?? 0) > 0;
  if (removed) await writeBlockAudit(blocker, blocked, "remove", "web");
  return { ok: removed };
}

export async function getBlocks(blockerId) {
  const id = toId(blockerId);
  if (!id) return [];
  return runQuery(
    `SELECT b.blockId, b.blockedId, b.reason, b.source, b.createdAt,
            u.username, u.uuid
       FROM userBlocks b
       JOIN users u ON u.userId = b.blockedId
      WHERE b.blockerId = ?
      ORDER BY b.createdAt DESC`,
    [id]
  );
}

function writeBlockAudit(actorId, targetId, action, source) {
  const verb = action === "add" ? "blocked" : "unblocked";
  return runQuery(
    `INSERT INTO logs (creatorId, logType, logFeature, description) VALUES (?, ?, ?, ?)`,
    [
      actorId,
      action === "add" ? "block" : "unblock",
      "friends",
      `User ${actorId} ${verb} user ${targetId} (source: ${source})`,
    ]
  ).catch((err) => {
    console.error("[friends] failed to write block audit log:", err);
  });
}

// ---------------------------------------------------------------------------
// Capability checks used by both the DM path and the request path
// ---------------------------------------------------------------------------

export async function canMessage(senderId, recipientId) {
  const sender = toId(senderId);
  const recipient = toId(recipientId);
  if (!sender || !recipient) return false;
  if (sender === recipient) return true;
  if (await isBlockedEitherWay(sender, recipient)) return false;

  const settings = await getPrivacySettings(recipient);
  if (settings.allowMessagesFrom === "everyone") return true;
  if (settings.allowMessagesFrom === "none") return false;
  return areFriends(sender, recipient);
}

export async function canSendFriendRequest(senderId, recipientId) {
  const sender = toId(senderId);
  const recipient = toId(recipientId);
  if (!sender || !recipient || sender === recipient) return false;
  if (await isBlockedEitherWay(sender, recipient)) return false;

  const recipientRow = await loadUserRow(recipient);
  if (!isValidTarget(recipientRow)) return false;

  const settings = await getPrivacySettings(recipient);
  if (settings.allowFriendRequests === "everyone") return true;
  if (settings.allowFriendRequests === "none") return false;
  return areFriends(sender, recipient);
}

// ---------------------------------------------------------------------------
// Privacy settings — lazily created, defaults applied on read
// ---------------------------------------------------------------------------

export async function getPrivacySettings(userId) {
  const id = toId(userId);
  if (!id) return { userId: null, ...PRIVACY_DEFAULTS };

  const rows = await runQuery(
    `SELECT allowMessagesFrom, allowFriendRequests, friendsListVisible,
            notifyFriendJoin, notifyFriendRequest
       FROM userPrivacySettings WHERE userId = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) return { userId: id, ...PRIVACY_DEFAULTS };

  const r = rows[0];
  return {
    userId: id,
    allowMessagesFrom: r.allowMessagesFrom,
    allowFriendRequests: r.allowFriendRequests,
    friendsListVisible: !!r.friendsListVisible,
    notifyFriendJoin: !!r.notifyFriendJoin,
    notifyFriendRequest: !!r.notifyFriendRequest,
  };
}

export async function setPrivacySettings(userId, patch = {}) {
  const id = toId(userId);
  if (!id) throw new FriendActionError("Unknown user.", "invalid_target");

  const enumCols = {
    allowMessagesFrom: MESSAGE_ENUM,
    allowFriendRequests: MESSAGE_ENUM,
  };
  const boolCols = [
    "friendsListVisible",
    "notifyFriendJoin",
    "notifyFriendRequest",
  ];

  const cols = [];
  const vals = [];

  for (const [col, allowed] of Object.entries(enumCols)) {
    if (patch[col] === undefined) continue;
    if (!allowed.includes(patch[col])) {
      throw new FriendActionError(`Invalid value for ${col}.`, "invalid_setting");
    }
    cols.push(col);
    vals.push(patch[col]);
  }
  for (const col of boolCols) {
    if (patch[col] === undefined) continue;
    cols.push(col);
    vals.push(patch[col] ? 1 : 0);
  }

  if (!cols.length) return getPrivacySettings(id);

  const insertCols = ["userId", ...cols].join(", ");
  const placeholders = ["?", ...cols.map(() => "?")].join(", ");
  const updates = cols.map((c) => `${c} = VALUES(${c})`).join(", ");

  await runQuery(
    `INSERT INTO userPrivacySettings (${insertCols}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updates}, updatedAt = NOW()`,
    [id, ...vals]
  );
  return getPrivacySettings(id);
}
