/**
 * lib/friendsCache.mjs
 *
 * In-process TTL cache for the two friends reads that run on every public
 * profile render: the plain friend count (keyed by userId) and the mutual-friend
 * lookup (keyed by the viewer/owner pair). 60-second TTL.
 *
 * Deliberately NOT a denormalised `users.friendCount` column — the
 * (requesterId|addresseeId, status) indexes make the COUNT cheap, and a cached
 * value that is at most 60s stale is fine for a crawlable public page. Measure
 * before adding a column that can drift.
 */

import {
  getFriendCount as dbGetFriendCount,
  getMutualFriends as dbGetMutualFriends,
} from "../controllers/friendController.js";

const TTL_MS = 60 * 1000;

const countCache = new Map(); // userId -> { value, expires }
const mutualCache = new Map(); // "viewerId:ownerId" -> { value, expires }

// Bound memory growth on a long-lived process.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of countCache) if (now > v.expires) countCache.delete(k);
  for (const [k, v] of mutualCache) if (now > v.expires) mutualCache.delete(k);
}, TTL_MS).unref?.();

export async function getCachedFriendCount(userId) {
  const key = Number(userId);
  const hit = countCache.get(key);
  if (hit && Date.now() < hit.expires) return hit.value;

  const value = await dbGetFriendCount(key);
  countCache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

export async function getCachedMutualFriends(viewerId, ownerId, opts = {}) {
  const key = `${Number(viewerId)}:${Number(ownerId)}`;
  const hit = mutualCache.get(key);
  if (hit && Date.now() < hit.expires) return hit.value;

  const value = await dbGetMutualFriends(viewerId, ownerId, opts);
  mutualCache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Drop cached entries touching a user after a mutation, so their own next view is fresh. */
export function invalidateFriendCaches(...userIds) {
  const ids = userIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  for (const id of ids) {
    countCache.delete(id);
    for (const key of mutualCache.keys()) {
      const [v, o] = key.split(":").map(Number);
      if (v === id || o === id) mutualCache.delete(key);
    }
  }
}
