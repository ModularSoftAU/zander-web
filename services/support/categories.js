/**
 * services/support/categories.js
 *
 * Support-ticket *category* data access: the category rows themselves, their
 * per-role permission grants, the Discord-category mapping column, and the
 * LuckPerms→Discord rank-role lookup used when syncing category staff into a
 * ticket.
 *
 * Extracted from controllers/supportTicketController.js (Phase 7 decomposition).
 * This module depends only on the DB layer — the controller re-exports every
 * name here so existing `controllers/supportTicketController.js` imports keep
 * working unchanged.
 */

import db, { luckpermsDb } from "../../controllers/databaseController.js";

let ticketCategoryDiscordColumnCheck;

async function ensureTicketCategoryDiscordColumn() {
    if (!ticketCategoryDiscordColumnCheck) {
        ticketCategoryDiscordColumnCheck = new Promise((resolve) => {
            db.query(
                "SHOW COLUMNS FROM supportTicketCategories LIKE 'discordCategoryId'",
                (err, results) => {
                    if (err) {
                        console.error(
                            "Failed to verify supportTicketCategories.discordCategoryId column",
                            err,
                        );
                        resolve(false);
                        return;
                    }

                    if (results.length > 0) {
                        resolve(true);
                        return;
                    }

                    db.query(
                        "ALTER TABLE supportTicketCategories ADD COLUMN discordCategoryId VARCHAR(255) NULL",
                        (alterErr) => {
                            if (alterErr) {
                                console.error(
                                    "Failed to add supportTicketCategories.discordCategoryId column",
                                    alterErr,
                                );
                                resolve(false);
                                return;
                            }

                            console.info(
                                "Added supportTicketCategories.discordCategoryId column for Discord category mapping",
                            );
                            resolve(true);
                        },
                    );
                },
            );
        });
    }

    return ticketCategoryDiscordColumnCheck;
}

export async function getSupportCategories() {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM supportTicketCategories", (err, results) => {
      if (err) reject(err);
      resolve(results);
    });
  });
}

export async function getCategoryDiscordParentId(categoryId) {
    const hasColumn = await ensureTicketCategoryDiscordColumn();
    if (!hasColumn || !categoryId) return null;

    return new Promise((resolve) => {
        db.query(
            "SELECT discordCategoryId FROM supportTicketCategories WHERE categoryId = ? LIMIT 1",
            [categoryId],
            (err, results) => {
                if (err) {
                    console.error("getCategoryDiscordParentId: failed to lookup category", err);
                    resolve(null);
                    return;
                }

                const discordCategoryId = results?.[0]?.discordCategoryId;
                const normalized = discordCategoryId ? String(discordCategoryId).trim() : "";
                if (!/^\d{5,}$/.test(normalized)) {
                    resolve(null);
                    return;
                }

                resolve(normalized);
            },
        );
    });
}

export async function ensureUncategorisedCategory() {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT categoryId FROM supportTicketCategories WHERE name = ? LIMIT 1",
      ["Uncategorised"],
      (lookupErr, results) => {
        if (lookupErr) return reject(lookupErr);

        if (results.length > 0) {
          return resolve(results[0].categoryId);
        }

        db.query(
          "INSERT INTO supportTicketCategories (name, description, enabled) VALUES (?, ?, 0)",
          ["Uncategorised", "Manual tickets created by staff"],
          (insertErr, insertResults) => {
            if (insertErr) return reject(insertErr);
            resolve(insertResults.insertId);
          }
        );
      }
    );
  });
}

export async function getSupportCategoriesWithPermissions() {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT c.*, GROUP_CONCAT(p.roleId) as permissions FROM supportTicketCategories c LEFT JOIN supportTicketCategoryPermissions p ON c.categoryId = p.categoryId GROUP BY c.categoryId",
      (err, results) => {
        if (err) reject(err);
        resolve(results);
      }
    );
  });
}

export async function getCategoryName(categoryId) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT name FROM supportTicketCategories WHERE categoryId = ?",
      [categoryId],
      (err, results) => {
        if (err) reject(err);
        resolve(results[0] ? results[0].name : "");
      }
    );
  });
}

export async function addCategoryPermission(categoryId, roleId) {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT 1 FROM supportTicketCategoryPermissions WHERE categoryId = ? AND roleId = ? LIMIT 1",
      [categoryId, roleId],
      (existingErr, existingResults) => {
        if (existingErr) return reject(existingErr);

        if (existingResults.length > 0) {
          return resolve({ alreadyExists: true });
        }

        db.query(
          "INSERT INTO supportTicketCategoryPermissions (categoryId, roleId) VALUES (?, ?)",
          [categoryId, roleId],
          (err, results) => {
            if (err) reject(err);
            resolve(results);
          }
        );
      }
    );
  });
}

export async function removeCategoryPermission(categoryId, roleId) {
    return new Promise((resolve, reject) => {
        db.query(
            "DELETE FROM supportTicketCategoryPermissions WHERE categoryId = ? AND roleId = ?",
            [categoryId, roleId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            },
        );
    });
}

export async function createSupportCategory(name, description, discordCategoryId = null) {
  const hasColumn = await ensureTicketCategoryDiscordColumn();

  return new Promise((resolve, reject) => {
    if (hasColumn && discordCategoryId) {
      db.query(
        "INSERT INTO supportTicketCategories (name, description, discordCategoryId) VALUES (?, ?, ?)",
        [name, description, discordCategoryId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    } else {
      db.query(
        "INSERT INTO supportTicketCategories (name, description) VALUES (?, ?)",
        [name, description],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    }
  });
}

// LuckPerms lives on a separate MySQL server from the main app DB, so this
// can't be read via the (cross-server, unreliable) `ranks` view — query
// luckpermsDb directly, scoped to server='global'/world='global' to match
// how the dashboard's rank config editor writes these nodes.
export async function getLuckPermRankRoles() {
    try {
        const rows = await new Promise((resolve, reject) => {
            luckpermsDb.query(
                `SELECT name, permission FROM luckperms_group_permissions
                  WHERE server = 'global' AND world = 'global' AND value = 1
                    AND (
                      permission LIKE 'displayname.%'
                      OR permission LIKE 'meta.discordid.%'
                      OR permission LIKE 'meta.rankbadgecolour.%'
                      OR permission LIKE 'meta.ranktextcolour.%'
                    )`,
                (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results);
                    }
                },
            );
        });

        const meta = new Map();
        for (const row of rows) {
            const m = meta.get(row.name) || {};
            const p = row.permission;
            if (p.startsWith("displayname.")) m.displayName = p.slice("displayname.".length);
            else if (p.startsWith("meta.discordid.")) m.discordRoleId = p.slice("meta.discordid.".length);
            else if (p.startsWith("meta.rankbadgecolour.")) m.rankBadgeColour = "#" + p.slice("meta.rankbadgecolour.".length);
            else if (p.startsWith("meta.ranktextcolour.")) m.rankTextColour = "#" + p.slice("meta.ranktextcolour.".length);
            meta.set(row.name, m);
        }

        return [...meta.entries()]
            .filter(([, m]) => m.discordRoleId)
            .map(([rankSlug, m]) => ({
                id: m.discordRoleId,
                name: m.displayName || rankSlug,
                rankSlug,
                badgeColor: m.rankBadgeColour || null,
                textColor: m.rankTextColour || null,
            }));
    } catch (error) {
        console.error("getLuckPermRankRoles: failed to fetch rank Discord role mappings", error);
        return [];
    }
}

export async function getCategoryById(id) {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM supportTicketCategories WHERE categoryId = ?", [id], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0]);
            }
        });
    });
}

export async function getCategoryPermissions(categoryId) {
    return new Promise((resolve, reject) => {
        db.query(
            "SELECT roleId FROM supportTicketCategoryPermissions WHERE categoryId = ?",
            [categoryId],
            (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(results.map((row) => row.roleId));
                }
            }
        );
    });
}

export async function updateSupportCategory(id, name, description, discordCategoryId = null) {
    const hasColumn = await ensureTicketCategoryDiscordColumn();

    return new Promise((resolve, reject) => {
        if (hasColumn) {
            db.query(
                "UPDATE supportTicketCategories SET name = ?, description = ?, discordCategoryId = ? WHERE categoryId = ?",
                [name, description, discordCategoryId || null, id],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        } else {
            db.query(
                "UPDATE supportTicketCategories SET name = ?, description = ? WHERE categoryId = ?",
                [name, description, id],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        }
    });
}

export async function deleteSupportCategory(id) {
    return new Promise((resolve, reject) => {
        db.query("DELETE FROM supportTicketCategories WHERE categoryId = ?", [id], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}
