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
    const [rows] = await db.promise().query(sql, [user.userId, permissionNode]);
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
    const [allCategories] = await db.promise().query(sql);

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
        const [rows] = await db.promise().query(sql, [categoryId]);
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
        const [discussions] = await db.promise().query(sql, [categoryId]);
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
    const [discussionRows] = await db.promise().query(discussionSql, [discussionUuid]);
    if (discussionRows.length === 0) return { error: 'Not Found' };
    const discussionInfo = discussionRows[0];

    if (discussionInfo.requiredPermission) {
        const userHasPerm = await hasPermission(user, discussionInfo.requiredPermission);
        if (!userHasPerm) return { error: 'No Permission' };
    }

    // 2. Function to get post details (author, ranks, body, etc.)
    const getPostDetails = async (post) => {
        const authorSql = `SELECT userId, uuid, username FROM users WHERE userId = ?`;
        const [authorRows] = await db.promise().query(authorSql, [post.authorId]);
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
        const [ranksRows] = await db.promise().query(ranksSql, [post.authorId]);
        post.authorRanks = ranksRows;

        const revisionSql = `SELECT * FROM forums_revisions WHERE ${post.replyId ? 'replyId = ?' : 'discussionId = ? AND replyId IS NULL'} AND active = 1`;
        const [revisionRows] = await db.promise().query(revisionSql, [post.replyId || post.discussionId]);
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
    if (!originalPost) return { error: 'Could not load original post' };

    // 4. Get all replies
    const repliesSql = `SELECT * FROM forums_replies WHERE discussionId = ? ORDER BY createdAt ASC`;
    const [repliesRows] = await db.promise().query(repliesSql, [discussionInfo.discussionId]);

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
        const [allCategories] = await db.promise().query(sql);
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
    // TODO: Permission check to create in this category
    // const canCreate = await hasPermission(user, `forums.discussion.create.${categoryId}`);
    // if (!canCreate) return { error: 'No permission to create discussions in this category.' };

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        const discussionUuid = uuidv4();
        const discussionSql = `
            INSERT INTO forums_discussions (uuid, categoryId, authorId, title, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        const [discussionResult] = await connection.query(discussionSql, [discussionUuid, categoryId, user.userId, title]);
        const discussionId = discussionResult.insertId;

        const revisionSql = `
            INSERT INTO forums_revisions (discussionId, authorId, title, body, createdAt, active, original)
            VALUES (?, ?, ?, ?, NOW(), 1, 1)
        `;
        await connection.query(revisionSql, [discussionId, user.userId, title, body]);

        await connection.commit();
        return { uuid: discussionUuid };

    } catch (error) {
        await connection.rollback();
        console.error("Error creating discussion:", error);
        return { error: 'Database error while creating discussion.' };
    } finally {
        connection.release();
    }
}
export async function createReply(discussionId, body, user) {
    if (!user) {
        return { error: 'You must be logged in to reply.' };
    }

    // Check if discussion is locked
    const [discussionRows] = await db.promise().query('SELECT locked FROM forums_discussions WHERE discussionId = ?', [discussionId]);
    if (discussionRows.length === 0 || discussionRows[0].locked) {
        return { error: 'You cannot reply to this discussion.' };
    }

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        const replySql = `
            INSERT INTO forums_replies (discussionId, authorId, createdAt, updatedAt)
            VALUES (?, ?, NOW(), NOW())
        `;
        const [replyResult] = await connection.query(replySql, [discussionId, user.userId]);
        const replyId = replyResult.insertId;

        const revisionSql = `
            INSERT INTO forums_revisions (discussionId, replyId, authorId, body, createdAt, active, original)
            VALUES (?, ?, ?, ?, NOW(), 1, 1)
        `;
        await connection.query(revisionSql, [discussionId, replyId, user.userId, body]);

        await connection.commit();
        return { success: true, replyId: replyId };

    } catch (error) {
        await connection.rollback();
        console.error("Error creating reply:", error);
        return { error: 'Database error while creating reply.' };
    } finally {
        connection.release();
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
        await db.promise().query(sql, [title, description, position, permission]);
        return { success: true };
    } catch (error) {
        console.error("Error creating category:", error);
        return { error: 'Database error' };
    }
}

export async function toggleDiscussionLocked(discussionId, user) {
    const canLock = await hasPermission(user, 'forums.discussion.lock');
    if (!canLock) {
        return { error: 'No permission' };
    }
    const sql = `UPDATE forums_discussions SET locked = NOT locked WHERE discussionId = ?`;
    await db.promise().query(sql, [discussionId]);
    return { success: true };
}

export async function toggleDiscussionStickied(discussionId, user) {
    const canSticky = await hasPermission(user, 'forums.discussion.sticky');
    if (!canSticky) {
        return { error: 'No permission' };
    }
    const sql = `UPDATE forums_discussions SET stickied = NOT stickied WHERE discussionId = ?`;
    await db.promise().query(sql, [discussionId]);
    return { success: true };
}

export async function updateCategory(categoryId, title, description, position, requiredPermission) {
    const sql = `
        UPDATE forums_categories
        SET title = ?, description = ?, position = ?, requiredPermission = ?
        WHERE categoryId = ?
    `;
    try {
        const permission = requiredPermission.trim() === '' ? null : requiredPermission.trim();
        await db.promise().query(sql, [title, description, position, permission, categoryId]);
        return { success: true };
    } catch (error) {
        console.error(`Error updating category ${categoryId}:`, error);
        return { error: 'Database error' };
    }
}

export async function archiveRevision(revisionId, user) {
    const canArchive = await hasPermission(user, 'forums.post.archive');
    if (!canArchive) {
        return { error: 'No permission' };
    }
    const sql = `UPDATE forums_revisions SET active = 0, archived = 1 WHERE revisionId = ?`;
    await db.promise().query(sql, [revisionId]);
    return { success: true };
}

export async function deleteCategory(categoryId) {
    // TODO: Add permission check for deleting categories
    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // 1. Find all discussions in the category
        const [discussions] = await connection.query('SELECT discussionId FROM forums_discussions WHERE categoryId = ?', [categoryId]);
        const discussionIds = discussions.map(d => d.discussionId);

        if (discussionIds.length > 0) {
            // 2. Delete revisions for all those discussions
            await connection.query('DELETE FROM forums_revisions WHERE discussionId IN (?)', [discussionIds]);

            // 3. Delete replies for all those discussions
            await connection.query('DELETE FROM forums_replies WHERE discussionId IN (?)', [discussionIds]);

            // 4. Delete the discussions themselves
            await connection.query('DELETE FROM forums_discussions WHERE discussionId IN (?)', [discussionIds]);
        }

        // 5. Delete the category
        await connection.query('DELETE FROM forums_categories WHERE categoryId = ?', [categoryId]);

        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        console.error(`Error deleting category ${categoryId}:`, error);
        return { error: 'Database error' };
    } finally {
        connection.release();
    }
}
// ... other controller functions to be added here ...
