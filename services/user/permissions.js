/**
 * services/user/permissions.js
 *
 * LuckPerms-backed permission + rank resolution (getUserPermissions, getRankPermissions, getUserRanks, checkPermissions).
 *
 * Extracted from controllers/userController.js (Phase 7 decomposition).
 * Re-exported by the controllers/userController.js barrel.
 */

import {
  runQuery,
  runLuckPermsQuery,
  normaliseUuid,
  LUCKPERMS_USER_PERMISSIONS_TABLE,
  LUCKPERMS_GROUP_PERMISSIONS_TABLE,
  LUCKPERMS_PLAYERS_TABLE,
} from "./_shared.js";

export async function getUserPermissions(userData = {}) {
  const permissionSet = new Set();
  const directRankOrder = [];
  const seenDirectRanks = new Set();
  const queuedRanks = [];
  const queuedRankSet = new Set();

  const userId = userData?.userId || null;
  // rawUuid is the LP-native UUID string (VARCHAR with dashes, e.g. "550e8400-e29b-41d4-a716-446655440000").
  // LuckPerms MySQL stores uuid as VARCHAR(36) with dashes, so LP queries must use this value
  // directly rather than UNHEX(hex-without-dashes), which would produce binary that never matches.
  let rawUuid = userData?.uuid || null;
  const username = userData?.username || null;

  // uuidHex is kept only as a non-null sentinel for the "do we have a UUID?" guards below.
  let uuidHex = normaliseUuid(rawUuid);

  const ensureUuid = async () => {
    if (uuidHex) {
      return;
    }

    if (userId) {
      const rows = await runQuery(
        `SELECT uuid FROM users WHERE userId = ? LIMIT 1`,
        [userId]
      );

      if (rows.length && rows[0].uuid) {
        rawUuid = rows[0].uuid;
        uuidHex = normaliseUuid(rows[0].uuid);
        return;
      }
    }

    if (username) {
      // LP stores uuid as VARCHAR(36) with dashes — select it as-is, no HEX() conversion.
      const rows = await runLuckPermsQuery(
        `SELECT uuid FROM ${LUCKPERMS_PLAYERS_TABLE} WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [username]
      );

      if (rows.length && rows[0].uuid) {
        rawUuid = rows[0].uuid;
        uuidHex = normaliseUuid(rows[0].uuid);
      }
    }
  };

  await ensureUuid();

  if (!uuidHex && !userId) {
    const emptyPermissions = [];
    emptyPermissions.userRanks = [];
    return emptyPermissions;
  }

  const pushPermission = (value) => {
    if (!value) return;
    permissionSet.add(value);
  };

  const queueRank = (slug, { direct = false } = {}) => {
    if (!slug) {
      return;
    }

    if (direct && !seenDirectRanks.has(slug)) {
      seenDirectRanks.add(slug);
      directRankOrder.push(slug);
    }

    if (!queuedRankSet.has(slug)) {
      queuedRankSet.add(slug);
      queuedRanks.push(slug);
    }
  };

  if (uuidHex) {
    try {
      const directPermissions = await runLuckPermsQuery(
        `SELECT permission
           FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ?
            AND permission NOT LIKE 'group.%'
            AND value = 1
            AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
        [rawUuid]
      );

      directPermissions.forEach(({ permission }) => pushPermission(permission));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch direct user permissions:", error);
    }

    try {
      const rankRows = await runLuckPermsQuery(
        `SELECT SUBSTRING_INDEX(permission, '.', -1) AS rankSlug
           FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ?
            AND permission LIKE 'group.%'
            AND value = 1
            AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())
          ORDER BY permission`,
        [rawUuid]
      );

      rankRows.forEach(({ rankSlug }) => queueRank(rankSlug, { direct: true }));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch user group assignments:", error);
    }
  }

  // Note: no further fallback here — ensureUuid() above already tried
  // resolving this user's uuid via the `users` table (and via LuckPerms'
  // own players table by username), which is the only source the old
  // `userRanks` view fallback could ever have matched against anyway (it
  // joined luckperms_user_permissions.uuid = users.uuid). If uuidHex is
  // still unset here, there's genuinely no uuid to resolve ranks from.

  if (!queuedRanks.length && uuidHex) {
    try {
      const primaryGroupRows = await runLuckPermsQuery(
        `SELECT primary_group AS rankSlug
           FROM ${LUCKPERMS_PLAYERS_TABLE}
          WHERE uuid = ?
          LIMIT 1`,
        [rawUuid]
      );

      primaryGroupRows.forEach(({ rankSlug }) => queueRank(rankSlug, { direct: true }));
    } catch (error) {
      console.error("[PERMISSIONS] Failed to fetch primary group:", error);
    }
  }

  while (queuedRanks.length) {
    const currentBatch = queuedRanks.splice(0, queuedRanks.length);
    const placeholders = currentBatch.map(() => "?").join(", ");

    try {
      const groupPermissions = await runLuckPermsQuery(
        `SELECT name, permission
           FROM ${LUCKPERMS_GROUP_PERMISSIONS_TABLE}
          WHERE name IN (${placeholders})
            AND value = 1
            AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
        currentBatch
      );

      groupPermissions.forEach(({ name, permission }) => {
        if (!permission) {
          return;
        }

        if (permission.startsWith("group.")) {
          const inherited = permission.substring("group.".length).trim();
          if (inherited && inherited !== name) {
            queueRank(inherited);
          }
          return;
        }

        pushPermission(permission);
      });
    } catch (error) {
      console.error(
        `[PERMISSIONS] Failed to fetch permissions for groups [${currentBatch.join(", ")}]:`,
        error
      );
    }
  }

  // Note: no further fallbacks here. Both the old `userPermissions` view
  // fallback (keyed on users.uuid — the same uuid ensureUuid() already
  // resolved, or failed to, above) and the old `rankPermissions` view
  // fallback (the same luckperms_group_permissions data the while-loop
  // above already fetches directly, minus the expiry filter it correctly
  // applies) were redundant with — and, for the expiry case, actively less
  // correct than — the direct LuckPerms queries already run above. LuckPerms
  // lives on a separate MySQL server from the main app DB, so those views
  // couldn't be joined cross-server reliably anyway.

  const permissions = Array.from(permissionSet);
  permissions.userRanks = directRankOrder;

  return permissions;
}

// LuckPerms lives on a separate MySQL server from the main app DB, so this
// can't be read via the (cross-server, unreliable) `rankPermissions` view —
// query luckpermsDb directly.
export async function getRankPermissions(allRanks) {
  if (!Array.isArray(allRanks) || allRanks.length === 0) {
    return [];
  }

  const placeholders = allRanks.map(() => "?").join(", ");
  const results = await runLuckPermsQuery(
    `SELECT DISTINCT permission
       FROM ${LUCKPERMS_GROUP_PERMISSIONS_TABLE}
      WHERE name IN (${placeholders})
        AND permission NOT LIKE 'group.%'
        AND value = 1
        AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
    allRanks
  );

  return results.map((row) => row.permission).filter(Boolean);
}

export async function getUserRanks(userData, userRanks = null) {
  const resolveLuckPermsUuid = async (input) => {
    if (typeof input === "string") {
      const username = input.trim();
      if (!username) return null;

      const localUsers = await runQuery(
        `SELECT uuid FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [username]
      );
      if (localUsers.length && localUsers[0].uuid) {
        return localUsers[0].uuid;
      }

      const lpUsers = await runLuckPermsQuery(
        `SELECT uuid FROM ${LUCKPERMS_PLAYERS_TABLE} WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [username]
      );
      return lpUsers[0]?.uuid || null;
    }

    if (input?.uuid) {
      return input.uuid;
    }

    if (input?.userId) {
      const users = await runQuery(
        `SELECT uuid FROM users WHERE userId = ? LIMIT 1`,
        [input.userId]
      );
      return users[0]?.uuid || null;
    }

    if (input?.username) {
      return resolveLuckPermsUuid(input.username);
    }

    return null;
  };

  // Call with just userData only get directly assigned ranks.
  if (userRanks === null) {
    const rawUuid = await resolveLuckPermsUuid(userData);
    if (!rawUuid) {
      return [];
    }

    const [groupRows, titleRows] = await Promise.all([
      runLuckPermsQuery(
        `SELECT SUBSTRING_INDEX(permission, '.', -1) AS rankSlug
           FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ?
            AND permission LIKE 'group.%'
            AND value = 1
            AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())
          ORDER BY permission`,
        [rawUuid]
      ),
      runLuckPermsQuery(
        `SELECT permission
           FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ?
            AND permission LIKE 'meta.group.%.title.%'
            AND value = 1
            AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
        [rawUuid]
      ),
    ]);

    const titleByRankSlug = {};
    for (const { permission } of titleRows) {
      const [rankSlug, title] = String(permission || "")
        .replace(/^meta\.group\./, "")
        .split(/\.title\./);

      if (rankSlug && title) {
        titleByRankSlug[rankSlug] = title;
      }
    }

    return groupRows.map((row) => ({
      rankSlug: row.rankSlug,
      title: titleByRankSlug[row.rankSlug] || null,
    }));
  }

  if (!Array.isArray(userRanks) || userRanks.length === 0) {
    return [];
  }

  const seen = new Set(userRanks.filter(Boolean));
  const queue = [...seen];

  while (queue.length) {
    const batch = queue.splice(0, queue.length);
    const placeholders = batch.map(() => "?").join(", ");
    const childRows = await runLuckPermsQuery(
      `SELECT SUBSTRING_INDEX(permission, '.', -1) AS rankSlug
         FROM ${LUCKPERMS_GROUP_PERMISSIONS_TABLE}
        WHERE name IN (${placeholders})
          AND permission LIKE 'group.%'
          AND value = 1
          AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
      batch
    );

    for (const { rankSlug } of childRows) {
      if (rankSlug && !seen.has(rankSlug)) {
        seen.add(rankSlug);
        queue.push(rankSlug);
      }
    }
  }

  return [...seen];
}

export async function checkPermissions(username, permissionNode) {
  try {
    const userPermissions = await getUserPermissions(username);
    const hasPermission = userPermissions.includes(permissionNode);

    return hasPermission;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
}

