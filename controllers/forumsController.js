import { createRequire } from "module";
const require = createRequire(import.meta.url);
import db from "./databaseController.js";
import { v4 as uuidv4 } from 'uuid';

/**
 * Checks if a user has a specific permission node.
 * @param {object} user - The user object from the session (req.session.user).
 * @param {string} permissionNode - The permission node to check (e.g., 'forums.category.view').
 * @returns {Promise<boolean>} - True if the user has the permission, false otherwise.
 */
function query(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) {
                return reject(err);
            }
            return resolve(results);
        });
    });
}

export async function hasPermission(user, permissionNode) {
    if (!user) {
        return false; // Not logged in
    }
    // Check for admin permission
    if (user.rank.isStaff === "1") {
        // TODO: Make this check more granular, maybe for a specific 'admin' rank
        // For now, staff can do anything.
        return true;
    }

    const sql = `
    SELECT COUNT(*) AS count
    FROM userPermissions
    WHERE userId = ? AND permission = ?
  `;
    try {
        const rows = await query(sql, [user.userId, permissionNode]);
        return rows[0].count > 0;
    } catch (error) {
        console.error("Error checking user permission:", error);
        return false;
    }
}

/**
 * Gets all forum categories that the user is allowed to see.
 */
export async function getCategories(user) {
    const sql = `SELECT * FROM forums_categories ORDER BY position ASC`;
    try {
        const allCategories = await query(sql);

        if (!user) {
            // Not logged in, only show public categories
            return allCategories.filter(c => !c.requiredPermission);
        }

        // User is logged in, check permissions for restricted categories
        const visibleCategories = [];
        for (const category of allCategories) {
            if (!category.requiredPermission) {
                visibleCategories.push(category); // Public category
            } else {
                // Check if user has the required permission
                const userHasPerm = await hasPermission(user, category.requiredPermission);
                if (userHasPerm) {
                    visibleCategories.push(category);
                }
            }
        }
        return visibleCategories;
    } catch (error) {
        console.error("Error fetching forum categories:", error);
        return []; // Return empty array on error
    }
}

/**
 * Gets a single category's metadata.
 */
export async function getCategory(categoryId, user) {
    const sql = `SELECT * FROM forums_categories WHERE categoryId = ?`;
    try {
        const rows = await query(sql, [categoryId]);
        if (rows.length === 0) {
            return null; // Not found
        }
        const category = rows[0];

        // Check permission
        if (category.requiredPermission) {
            const userHasPerm = await hasPermission(user, category.requiredPermission);
            if (!userHasPerm) {
                return null; // No permission
            }
        }
        return category;
    } catch (error) {
        console.error(`Error fetching category ${categoryId}:`, error);
        return null;
    }
}

/**
 * Gets all discussions within a specific category.
 */
export async function getDiscussionsByCategory(categoryId, user) {
    // First, verify the user can even see this category
    const category = await getCategory(categoryId, user);
    if (!category) {
        return { error: 'Not Found or No Permission' };
    }

    const sql = `
        SELECT
            d.discussionId,
            d.uuid,
            d.title,
            d.createdAt,
            d.locked,
            d.stickied,
            u.username AS authorName,
            COUNT(r.replyId) AS replyCount,
            MAX(r.createdAt) AS lastReplyAt
        FROM forums_discussions d
        JOIN users u ON d.authorId = u.userId
        LEFT JOIN forums_replies r ON d.discussionId = r.discussionId
        WHERE d.categoryId = ?
        GROUP BY d.discussionId
        ORDER BY d.stickied DESC, lastReplyAt DESC, d.createdAt DESC
    `;
    try {
        const discussions = await query(sql, [categoryId]);
        return { category, discussions };
    } catch (error) {
        console.error(`Error fetching discussions for category ${categoryId}:`, error);
        return { error: 'Database Error' };
    }
}

/**
 * Gets a single discussion and its replies.
 */
export async function getDiscussion(discussionUuid, user) {
    // 1. Find discussion and check category permission
    const discussionSql = `
        SELECT d.*, c.requiredPermission
        FROM forums_discussions d
        JOIN forums_categories c ON d.categoryId = c.categoryId
        WHERE d.uuid = ?
    `;
    const discussionRows = await query(discussionSql, [discussionUuid]);
    if (discussionRows.length === 0) return { error: 'Discussion not found.' };
    const discussionInfo = discussionRows[0];

    if (discussionInfo.requiredPermission) {
        const userHasPerm = await hasPermission(user, discussionInfo.requiredPermission);
        if (!userHasPerm) return { error: 'No Permission' };
    }

    // 2. Function to get post details (author, ranks, body, etc.)
    const getPostDetails = async (post) => {
        const authorSql = `SELECT userId, uuid, username FROM users WHERE userId = ?`;
        const authorRows = await query(authorSql, [post.authorId]);
        if (authorRows.length === 0) return null; // Should not happen
        post.authorName = authorRows[0].username;
        post.authorUuid = authorRows[0].uuid;

        const ranksSql = `
            SELECT r.displayName, r.rankBadgeColour, r.rankTextColour
            FROM userRanks ur
            JOIN ranks r ON ur.rankSlug = r.rankSlug
            WHERE ur.userId = ?
            ORDER BY r.priority DESC
        `;
        const ranksRows = await query(ranksSql, [post.authorId]);
        post.authorRanks = ranksRows;

        const revisionSql = `SELECT * FROM forums_revisions WHERE ${post.replyId ? 'replyId = ?' : 'discussionId = ? AND replyId IS NULL'} AND active = 1`;
        const revisionRows = await query(revisionSql, [post.replyId || post.discussionId]);
        if (revisionRows.length === 0) return null; // Should not happen

        post.body = revisionRows[0].body;
        post.revisionId = revisionRows[0].revisionId;
        post.updatedAt = revisionRows[0].createdAt; // Use revision creation as update time
        post.postId = post.replyId || post.discussionId; // A unique ID for the #anchor
        if(!post.replyId) {
            discussionInfo.title = revisionRows[0].title;
        }

        return post;
    };

    // 3. Get the original post
    const originalPost = await getPostDetails({ ...discussionInfo });
    if (!originalPost) return { error: 'Could not load the original post. It may be corrupted or archived.' };

    // 4. Get all replies
    const repliesSql = `SELECT * FROM forums_replies WHERE discussionId = ? ORDER BY createdAt ASC`;
    const repliesRows = await query(repliesSql, [discussionInfo.discussionId]);

    const replies = [];
    for (const reply of repliesRows) {
        const detailedReply = await getPostDetails(reply);
        if (detailedReply) {
            replies.push(detailedReply);
        }
    }

    return { discussion: { ...discussionInfo, originalPost }, replies };
}

/**
 * Gets all categories for the admin panel, without permission checks.
 */
export async function getAllCategoriesAdmin() {
    const sql = `SELECT * FROM forums_categories ORDER BY position ASC`;
    try {
        const allCategories = await query(sql);
        return allCategories;
    } catch (error) {
        console.error("Error fetching all forum categories for admin:", error);
        return [];
    }
}

export async function createDiscussion(categoryId, title, body, user) {
    if (!user) {
        return { error: 'You must be logged in to create a discussion.' };
    }
    // Permission to create is handled in the route

    let connection;
    try {
        connection = await new Promise((resolve, reject) => {
            db.getConnection((err, conn) => {
                if (err) reject(err);
                resolve(conn);
            });
        });

        await new Promise((resolve, reject) => connection.beginTransaction(err => err ? reject(err) : resolve()));

        const discussionUuid = uuidv4();
        const discussionSql = `
            INSERT INTO forums_discussions (uuid, categoryId, authorId, title, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        const discussionResult = await new Promise((resolve, reject) => {
            connection.query(discussionSql, [discussionUuid, categoryId, user.userId, title], (err, res) => err ? reject(err) : resolve(res));
        });
        const discussionId = discussionResult.insertId;

        const revisionSql = `
            INSERT INTO forums_revisions (discussionId, authorId, title, body, createdAt, active, original)
            VALUES (?, ?, ?, ?, NOW(), 1, 1)
        `;
        await new Promise((resolve, reject) => {
            connection.query(revisionSql, [discussionId, user.userId, title, body], (err, res) => err ? reject(err) : resolve(res));
        });

        await new Promise((resolve, reject) => connection.commit(err => err ? reject(err) : resolve()));

        return { uuid: discussionUuid };

    } catch (error) {
        if (connection) await new Promise((resolve, reject) => connection.rollback(() => resolve()));
        console.error("Error creating discussion:", error);
        return { error: 'A database error occurred while creating the discussion.' };
    } finally {
        if (connection) connection.release();
    }
}
export async function createReply(discussionId, body, user) {
    if (!user) {
        return { error: 'You must be logged in to reply.' };
    }

    // Check if discussion is locked
    const discussionRows = await query('SELECT locked FROM forums_discussions WHERE discussionId = ?', [discussionId]);
    if (discussionRows.length === 0 || discussionRows[0].locked) {
        return { error: 'You cannot reply to this discussion.' };
    }

    let connection;
    try {
        connection = await new Promise((resolve, reject) => db.getConnection((err, conn) => err ? reject(err) : resolve(conn)));
        await new Promise((resolve, reject) => connection.beginTransaction(err => err ? reject(err) : resolve()));

        const replySql = `
            INSERT INTO forums_replies (discussionId, authorId, createdAt, updatedAt)
            VALUES (?, ?, NOW(), NOW())
        `;
        const replyResult = await new Promise((resolve, reject) => {
            connection.query(replySql, [discussionId, user.userId], (err, res) => err ? reject(err) : resolve(res));
        });
        const replyId = replyResult.insertId;

        const revisionSql = `
            INSERT INTO forums_revisions (discussionId, replyId, authorId, body, createdAt, active, original)
            VALUES (?, ?, ?, ?, NOW(), 1, 1)
        `;
        await new Promise((resolve, reject) => {
            connection.query(revisionSql, [discussionId, replyId, user.userId, body], (err, res) => err ? reject(err) : resolve(res));
        });

        await new Promise((resolve, reject) => connection.commit(err => err ? reject(err) : resolve()));
        return { success: true, replyId: replyId };

    } catch (error) {
        if (connection) await new Promise((resolve, reject) => connection.rollback(() => resolve()));
        console.error("Error creating reply:", error);
        return { error: 'A database error occurred while creating the reply.' };
    } finally {
        if (connection) connection.release();
    }
}

export async function createCategory(title, description, position, requiredPermission) {
    const sql = `
        INSERT INTO forums_categories (title, description, position, requiredPermission)
        VALUES (?, ?, ?, ?)
    `;
    try {
        // Use NULL for empty string in permission
        const permission = requiredPermission.trim() === '' ? null : requiredPermission.trim();
        await query(sql, [title, description, position, permission]);
        return { success: true };
    } catch (error) {
        console.error("Error creating category:", error);
        return { error: 'Database error' };
    }
}

export async function toggleDiscussionLocked(discussionId, user) {
    // Permission is checked in the route
    const sql = `UPDATE forums_discussions SET locked = NOT locked WHERE discussionId = ?`;
    await query(sql, [discussionId]);
    return { success: true };
}

export async function toggleDiscussionStickied(discussionId, user) {
    // Permission is checked in the route
    const sql = `UPDATE forums_discussions SET stickied = NOT stickied WHERE discussionId = ?`;
    await query(sql, [discussionId]);
    return { success: true };
}

export async function updateCategory(categoryId, title, description, position, requiredPermission) {
    // Permission is checked in the route
    const sql = `
        UPDATE forums_categories
        SET title = ?, description = ?, position = ?, requiredPermission = ?
        WHERE categoryId = ?
    `;
    try {
        const permission = requiredPermission.trim() === '' ? null : requiredPermission.trim();
        await query(sql, [title, description, position, permission, categoryId]);
        return { success: true };
    } catch (error) {
        console.error(`Error updating category ${categoryId}:`, error);
        return { error: 'Database error' };
    }
}

export async function archiveRevision(revisionId, user) {
    // Permission is checked in the route
    const sql = `UPDATE forums_revisions SET active = 0, archived = 1 WHERE revisionId = ?`;
    await query(sql, [revisionId]);
    return { success: true };
}

export async function deleteCategory(categoryId) {
    // Permission is checked in the route
    let connection;
    try {
        connection = await new Promise((resolve, reject) => db.getConnection((err, conn) => err ? reject(err) : resolve(conn)));
        await new Promise((resolve, reject) => connection.beginTransaction(err => err ? reject(err) : resolve()));

        // 1. Find all discussions in the category
        const discussions = await new Promise((resolve, reject) => {
            connection.query('SELECT discussionId FROM forums_discussions WHERE categoryId = ?', [categoryId], (err, res) => err ? reject(err) : resolve(res));
        });
        const discussionIds = discussions.map(d => d.discussionId);

        if (discussionIds.length > 0) {
            // 2. Delete revisions for all those discussions
            await new Promise((resolve, reject) => connection.query('DELETE FROM forums_revisions WHERE discussionId IN (?)', [discussionIds], (err, res) => err ? reject(err) : resolve(res)));

            // 3. Delete replies for all those discussions
            await new Promise((resolve, reject) => connection.query('DELETE FROM forums_replies WHERE discussionId IN (?)', [discussionIds], (err, res) => err ? reject(err) : resolve(res)));

            // 4. Delete the discussions themselves
            await new Promise((resolve, reject) => connection.query('DELETE FROM forums_discussions WHERE discussionId IN (?)', [discussionIds], (err, res) => err ? reject(err) : resolve(res)));
        }

        // 5. Delete the category
        await new Promise((resolve, reject) => connection.query('DELETE FROM forums_categories WHERE categoryId = ?', [categoryId], (err, res) => err ? reject(err) : resolve(res)));

        await new Promise((resolve, reject) => connection.commit(err => err ? reject(err) : resolve()));
        return { success: true };
    } catch (error) {
        if (connection) await new Promise((resolve, reject) => connection.rollback(() => resolve()));
        console.error(`Error deleting category ${categoryId}:`, error);
        return { error: 'A database error occurred while deleting the category.' };
    } finally {
        if (connection) connection.release();
    }
}
// ... other controller functions to be added here ...
