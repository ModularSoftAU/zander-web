/**
 * services/support/users.js
 *
 * User lookups the support-ticket layer needs: resolving users by id / Discord id
 * / free-text identifier, the staff-picker searches, placeholder-user creation,
 * and the LuckPerms-backed "what Discord roles / rank slugs does this user have"
 * queries used when syncing ticket participants.
 *
 * Extracted from controllers/supportTicketController.js (Phase 7 decomposition).
 * The controller re-exports every name here so existing import sites are
 * unchanged.
 */

import db, { luckpermsDb } from "../../controllers/databaseController.js";
import { buildAvatarUrl } from "./internal.js";

export async function getUserIdByDiscordId(discordId) {
    return new Promise((resolve, reject) => {
        db.query("SELECT userId FROM users WHERE discordId = ?", [discordId], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0] ? results[0].userId : null);
            }
        });
    });
}

export async function getUserById(userId) {
    if (!userId) return null;

    return new Promise((resolve) => {
        db.query(
            "SELECT userId, username, discordId, profilePicture_type, profilePicture_email, uuid FROM users WHERE userId = ? LIMIT 1",
            [userId],
            (err, results) => {
                if (err) {
                    console.error("getUserById: failed to lookup user", err);
                    resolve(null);
                } else {
                    resolve(results?.[0] || null);
                }
            },
        );
    });
}

export async function findUserByIdentifier(identifier) {
    const lookup = identifier?.trim();
    if (!lookup) return null;

    return new Promise((resolve, reject) => {
        db.query(
            "SELECT userId, username, discordId FROM users WHERE LOWER(username) = LOWER(?) OR userId = ? OR discordId = ? LIMIT 1",
            [lookup, lookup, lookup],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results[0] || null);
                }
            },
        );
    });
}

export async function searchUsersByUsername(query) {
    const term = query?.trim();
    if (!term || term.length < 2) return [];

    return new Promise((resolve) => {
        db.query(
            "SELECT userId, username, profilePicture_type, profilePicture_email, uuid FROM users WHERE username LIKE ? ORDER BY username ASC LIMIT 8",
            [`${term}%`],
            async (err, results) => {
                if (err) {
                    console.error("searchUsersByUsername: failed to run query", err);
                    resolve([]);
                    return;
                }

                const enriched = await Promise.all(
                    results.map(async (row) => ({
                        ...row,
                        avatarUrl: await buildAvatarUrl(row),
                    })),
                );
                resolve(enriched);
            },
        );
    });
}

export async function searchLinkedUsers(query) {
    const term = query?.trim();
    if (!term || term.length < 2) return [];

    return new Promise((resolve) => {
        db.query(
            "SELECT userId, username, discordId, profilePicture_type, profilePicture_email, uuid FROM users WHERE username LIKE ? AND discordId IS NOT NULL ORDER BY username ASC LIMIT 8",
            [`${term}%`],
            async (err, results) => {
                if (err) {
                    console.error("searchLinkedUsers: failed to run query", err);
                    resolve([]);
                    return;
                }

                const enriched = await Promise.all(
                    results.map(async (row) => ({
                        userId: row.userId,
                        username: row.username,
                        discordId: row.discordId,
                        avatarUrl: await buildAvatarUrl(row),
                    })),
                );
                resolve(enriched);
            },
        );
    });
}

export async function createUnlinkedUser(discordId, username) {
    // Truncate username to fit VARCHAR(16) column – Discord usernames can be up to 32 chars
    const safeName = username ? username.substring(0, 16) : "Unknown";
    return new Promise((resolve, reject) => {
        db.query("INSERT INTO users (discordId, username, uuid, is_placeholder) VALUES (?, ?, UUID(), 1)", [discordId, safeName], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results.insertId);
            }
        });
    });
}

// LuckPerms lives on a separate MySQL server from the main app DB, so these
// can't be read via the (cross-server, unreliable) `userRanks` view —
// resolve the user's uuid from the main DB, then query luckpermsDb directly.
async function getUserUuidByUserId(userId) {
    const rows = await new Promise((resolve, reject) => {
        db.query(
            "SELECT uuid FROM users WHERE userId = ? LIMIT 1",
            [userId],
            (err, results) => (err ? reject(err) : resolve(results)),
        );
    });
    return rows[0]?.uuid ? rows[0].uuid.toLowerCase() : null;
}

async function getUserGroupSlugs(uuid) {
    if (!uuid) return [];
    const rows = await new Promise((resolve, reject) => {
        luckpermsDb.query(
            `SELECT SUBSTRING_INDEX(permission, '.', -1) AS rankSlug
               FROM luckperms_user_permissions
              WHERE uuid = ? AND permission LIKE 'group.%' AND value = 1
                AND (expiry IS NULL OR expiry = 0 OR expiry > UNIX_TIMESTAMP())`,
            [uuid],
            (err, results) => (err ? reject(err) : resolve(results)),
        );
    });
    return rows.map((r) => r.rankSlug);
}

export async function getUserRoles(userId) {
    const uuid = await getUserUuidByUserId(userId);
    const rankSlugs = await getUserGroupSlugs(uuid);
    if (!rankSlugs.length) return [];

    const rows = await new Promise((resolve, reject) => {
        luckpermsDb.query(
            `SELECT SUBSTRING_INDEX(permission, '.', -1) AS discordRoleId
               FROM luckperms_group_permissions
              WHERE name IN (?) AND permission LIKE 'meta.discordid.%' AND value = 1
                AND server = 'global' AND world = 'global'`,
            [rankSlugs],
            (err, results) => (err ? reject(err) : resolve(results)),
        );
    });
    return rows.map((r) => r.discordRoleId).filter(Boolean);
}

export async function getUserRankSlugs(userId) {
    const uuid = await getUserUuidByUserId(userId);
    return getUserGroupSlugs(uuid);
}
