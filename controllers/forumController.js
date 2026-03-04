import db from "./databaseController.js";
import { hashEmail } from "../api/common.js";

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) {
        return reject(error);
      }

      resolve(results || []);
    });
  });
}

function slugify(value) {
  if (!value) {
    return "item";
  }

  const base = String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .toLowerCase();

  return base || "item";
}

export function permissionMatch(permissions, node) {
  if (!node) {
    return true;
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }

  const target = String(node).trim().toLowerCase();
  if (!target) {
    return true;
  }

  return permissions.some((permission) => {
    if (!permission) {
      return false;
    }

    const candidate = String(permission).trim().toLowerCase();
    if (!candidate) {
      return false;
    }

    if (candidate === "*") {
      return true;
    }

    if (candidate === target) {
      return true;
    }

    if (candidate.endsWith(".*")) {
      const base = candidate.slice(0, -1);
      return target.startsWith(base);
    }

    return false;
  });
}

function mapCategoryRow(row) {
  return {
    categoryId: row.categoryId,
    parentCategoryId: row.parentCategoryId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    position: row.position ?? 0,
    viewPermission: row.viewPermission || null,
    postPermission: row.postPermission || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function fetchCategoriesRaw() {
  const rows = await query(
    `SELECT categoryId, parentCategoryId, name, slug, description, position, viewPermission, postPermission, createdAt, updatedAt
       FROM forumCategories
      ORDER BY position ASC, name ASC`
  );

  return rows.map((row) => mapCategoryRow(row));
}

function buildCategoryTree(rows, permissions = null) {
  const categories = new Map();
  rows.forEach((row) => {
    categories.set(row.categoryId, { ...row, children: [], isAccessible: true });
  });

  categories.forEach((category) => {
    if (category.parentCategoryId && categories.has(category.parentCategoryId)) {
      categories.get(category.parentCategoryId).children.push(category);
    }
  });

  const roots = [];
  categories.forEach((category) => {
    if (!category.parentCategoryId) {
      roots.push(category);
    }
  });

  const accessibleFlat = [];

  const sortChildren = (children) => {
    return children
      .sort((a, b) => {
        if (a.position === b.position) {
          return a.name.localeCompare(b.name);
        }
        return (a.position ?? 0) - (b.position ?? 0);
      })
      .map((child) => {
        child.children = sortChildren(child.children);
        return child;
      });
  };

  const filterNode = (node) => {
    node.children = sortChildren(node.children).filter((child) => filterNode(child));

    const hasAccess = permissions
      ? permissionMatch(permissions, node.viewPermission)
      : true;
    const hasAccessibleChild = node.children.length > 0;

    node.isAccessible = hasAccess;

    if (hasAccess) {
      accessibleFlat.push(node);
    }

    return hasAccess || hasAccessibleChild;
  };

  const filteredRoots = sortChildren(roots).filter((root) => filterNode(root));

  return {
    tree: filteredRoots,
    flat: accessibleFlat,
  };
}

export async function getCategoriesForUser(permissions = null) {
  const rows = await fetchCategoriesRaw();
  return buildCategoryTree(rows, permissions);
}

export async function getAllCategoriesForAdmin() {
  const rows = await fetchCategoriesRaw();
  return buildCategoryTree(rows, null);
}

export async function getCategoryBySlug(slug) {
  const [row] = await query(
    `SELECT categoryId, parentCategoryId, name, slug, description, position, viewPermission, postPermission, createdAt, updatedAt
       FROM forumCategories
      WHERE slug = ?
      LIMIT 1`,
    [slug],
  );

  return row ? mapCategoryRow(row) : null;
}

export async function getCategoryById(categoryId) {
  const [row] = await query(
    `SELECT categoryId, parentCategoryId, name, slug, description, position, viewPermission, postPermission, createdAt, updatedAt
       FROM forumCategories
      WHERE categoryId = ?
      LIMIT 1`,
    [categoryId],
  );

  return row ? mapCategoryRow(row) : null;
}

async function ensureUniqueCategorySlug(baseName, excludeCategoryId = null) {
  const baseSlug = slugify(baseName);
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const params = [candidate];
    let queryText =
      "SELECT categoryId FROM forumCategories WHERE slug = ?";

    if (excludeCategoryId) {
      queryText += " AND categoryId <> ?";
      params.push(excludeCategoryId);
    }

    const rows = await query(`${queryText} LIMIT 1`, params);
    if (!rows.length) {
      return candidate;
    }

    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
}

async function ensureUniqueDiscussionSlug(categoryId, baseName, excludeDiscussionId = null) {
  const baseSlug = slugify(baseName);
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const params = [categoryId, candidate];
    let queryText =
      "SELECT discussionId FROM forumDiscussions WHERE categoryId = ? AND slug = ?";

    if (excludeDiscussionId) {
      queryText += " AND discussionId <> ?";
      params.push(excludeDiscussionId);
    }

    const rows = await query(`${queryText} LIMIT 1`, params);
    if (!rows.length) {
      return candidate;
    }

    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }
}

export async function createCategory({
  name,
  slug,
  description,
  parentCategoryId = null,
  position = 0,
  viewPermission = null,
  postPermission = null,
}) {
  const effectiveSlug = slug
    ? await ensureUniqueCategorySlug(slug, null)
    : await ensureUniqueCategorySlug(name, null);

  const result = await query(
    `INSERT INTO forumCategories
      (parentCategoryId, name, slug, description, position, viewPermission, postPermission)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      parentCategoryId || null,
      name,
      effectiveSlug,
      description || null,
      position ?? 0,
      viewPermission || null,
      postPermission || null,
    ]
  );

  const insertedId = result.insertId || result?.[0]?.insertId;
  return getCategoryById(insertedId);
}

export async function updateCategory(categoryId, {
  name,
  slug,
  description,
  parentCategoryId = null,
  position = 0,
  viewPermission = null,
  postPermission = null,
}) {
  const existing = await getCategoryById(categoryId);
  if (!existing) {
    return null;
  }

  let effectiveSlug = existing.slug;
  if (slug && slug !== existing.slug) {
    effectiveSlug = await ensureUniqueCategorySlug(slug, categoryId);
  } else if (!slug && name && name !== existing.name) {
    effectiveSlug = await ensureUniqueCategorySlug(name, categoryId);
  }

  await query(
    `UPDATE forumCategories
        SET parentCategoryId = ?,
            name = ?,
            slug = ?,
            description = ?,
            position = ?,
            viewPermission = ?,
            postPermission = ?,
            updatedAt = NOW()
      WHERE categoryId = ?`,
    [
      parentCategoryId || null,
      name,
      effectiveSlug,
      description || null,
      position ?? 0,
      viewPermission || null,
      postPermission || null,
      categoryId,
    ]
  );

  return getCategoryById(categoryId);
}

export async function deleteCategory(categoryId) {
  await query(`DELETE FROM forumCategories WHERE categoryId = ?`, [categoryId]);
}

function mapDiscussionRow(row) {
  if (!row) {
    return null;
  }

  return {
    discussionId: row.discussionId,
    categoryId: row.categoryId,
    title: row.title,
    slug: row.slug,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastPostAt: row.lastPostAt,
    lastPostBy: row.lastPostBy,
    isLocked: !!row.isLocked,
    isSticky: !!row.isSticky,
    isArchived: !!row.isArchived,
  };
}

async function getDiscussionRow(discussionId) {
  const [row] = await query(
    `SELECT discussionId, categoryId, title, slug, createdBy, createdAt, updatedAt, lastPostAt, lastPostBy, isLocked, isSticky, isArchived
       FROM forumDiscussions
      WHERE discussionId = ?
      LIMIT 1`,
    [discussionId],
  );

  return mapDiscussionRow(row);
}

export async function getDiscussionWithCategory(discussionId) {
  const [row] = await query(
    `SELECT d.discussionId,
            d.categoryId,
            d.title,
            d.slug,
            d.createdBy,
            d.createdAt,
            d.updatedAt,
            d.lastPostAt,
            d.lastPostBy,
            d.isLocked,
            d.isSticky,
            d.isArchived,
            c.name       AS categoryName,
            c.slug       AS categorySlug,
            c.description AS categoryDescription,
            c.position   AS categoryPosition,
            c.viewPermission,
            c.postPermission,
            c.parentCategoryId
       FROM forumDiscussions d
       JOIN forumCategories c ON c.categoryId = d.categoryId
      WHERE d.discussionId = ?
      LIMIT 1`,
    [discussionId],
  );

  if (!row) {
    return null;
  }

  return {
    discussion: mapDiscussionRow(row),
    category: {
      categoryId: row.categoryId,
      parentCategoryId: row.parentCategoryId,
      name: row.categoryName,
      slug: row.categorySlug,
      description: row.categoryDescription,
      position: row.categoryPosition ?? 0,
      viewPermission: row.viewPermission || null,
      postPermission: row.postPermission || null,
    },
  };
}

async function getDiscussionBySlug(categoryId, slug) {
  const [row] = await query(
    `SELECT discussionId
       FROM forumDiscussions
      WHERE categoryId = ?
        AND slug = ?
      LIMIT 1`,
    [categoryId, slug],
  );

  return row ? row.discussionId : null;
}

async function getOriginalPost(discussionId) {
  const [row] = await query(
    `SELECT postId, discussionId, userId, content, isOriginal, createdAt, updatedAt
       FROM forumPosts
      WHERE discussionId = ?
        AND isOriginal = 1
      LIMIT 1`,
    [discussionId],
  );

  return row || null;
}

async function recordPostRevision(postId, editorId, previousContent) {
  if (!previousContent) {
    return;
  }

  await query(
    `INSERT INTO forumPostRevisions (postId, editorId, previousContent)
     VALUES (?, ?, ?)`,
    [postId, editorId || null, previousContent],
  );
}

async function recalculateDiscussionMeta(discussionId) {
  const [lastPost] = await query(
    `SELECT postId, userId, createdAt
       FROM forumPosts
      WHERE discussionId = ?
      ORDER BY createdAt DESC, postId DESC
      LIMIT 1`,
    [discussionId],
  );

  if (lastPost) {
    await query(
      `UPDATE forumDiscussions
          SET lastPostAt = ?,
              lastPostBy = ?,
              updatedAt = NOW()
        WHERE discussionId = ?`,
      [lastPost.createdAt, lastPost.userId, discussionId],
    );
  } else {
    await query(
      `UPDATE forumDiscussions
          SET lastPostAt = createdAt,
              lastPostBy = createdBy,
              updatedAt = NOW()
        WHERE discussionId = ?`,
      [discussionId],
    );
  }
}

export async function createDiscussion({ categoryId, userId, title, content }) {
  const slug = await ensureUniqueDiscussionSlug(categoryId, title, null);

  const result = await query(
    `INSERT INTO forumDiscussions
      (categoryId, title, slug, createdBy, lastPostBy)
    VALUES (?, ?, ?, ?, ?)`,
    [categoryId, title, slug, userId, userId],
  );

  const discussionId = result.insertId || result?.[0]?.insertId;

  await query(
    `INSERT INTO forumPosts
      (discussionId, userId, content, isOriginal)
    VALUES (?, ?, ?, 1)`,
    [discussionId, userId, content],
  );

  await recalculateDiscussionMeta(discussionId);

  return getDiscussionRow(discussionId);
}

export async function updateDiscussion(discussionId, { title, content, editorUserId }) {
  const discussion = await getDiscussionRow(discussionId);
  if (!discussion) {
    return null;
  }

  if (title && title !== discussion.title) {
    await query(
      `UPDATE forumDiscussions
          SET title = ?,
              updatedAt = NOW()
        WHERE discussionId = ?`,
      [title, discussionId],
    );
  }

  if (content !== undefined && content !== null) {
    const originalPost = await getOriginalPost(discussionId);
    if (originalPost && originalPost.content !== content) {
      await recordPostRevision(originalPost.postId, editorUserId, originalPost.content);

      await query(
        `UPDATE forumPosts
            SET content = ?,
                updatedAt = NOW()
          WHERE postId = ?`,
        [content, originalPost.postId],
      );
    }
  }

  await query(
    `UPDATE forumDiscussions
        SET updatedAt = NOW()
      WHERE discussionId = ?`,
    [discussionId],
  );

  return getDiscussionRow(discussionId);
}

export async function deleteDiscussion(discussionId) {
  await query(`DELETE FROM forumDiscussions WHERE discussionId = ?`, [discussionId]);
}

export async function moveDiscussion(discussionId, newCategoryId) {
  await query(
    `UPDATE forumDiscussions SET categoryId = ?, updatedAt = NOW() WHERE discussionId = ?`,
    [newCategoryId, discussionId],
  );
}

export async function createReply({ discussionId, userId, content }) {
  const result = await query(
    `INSERT INTO forumPosts (discussionId, userId, content, isOriginal)
     VALUES (?, ?, ?, 0)`,
    [discussionId, userId, content],
  );

  const postId = result.insertId || result?.[0]?.insertId;

  await query(
    `UPDATE forumDiscussions
        SET lastPostAt = NOW(),
            lastPostBy = ?,
            updatedAt = NOW()
      WHERE discussionId = ?`,
    [userId, discussionId],
  );

  return postId;
}

export async function getPostById(postId) {
  const [row] = await query(
    `SELECT postId, discussionId, userId, content, isOriginal, createdAt, updatedAt
       FROM forumPosts
      WHERE postId = ?
      LIMIT 1`,
    [postId],
  );

  return row || null;
}

export async function updatePost(postId, { content, editorUserId }) {
  const post = await getPostById(postId);
  if (!post) {
    return null;
  }

  if (content === post.content) {
    return post;
  }

  await recordPostRevision(postId, editorUserId, post.content);

  await query(
    `UPDATE forumPosts
        SET content = ?,
            updatedAt = NOW()
      WHERE postId = ?`,
    [content, postId],
  );

  await query(
    `UPDATE forumDiscussions
        SET updatedAt = NOW()
      WHERE discussionId = ?`,
    [post.discussionId],
  );

  if (!post.isOriginal) {
    await recalculateDiscussionMeta(post.discussionId);
  }

  return getPostById(postId);
}

export async function deletePost(postId) {
  const post = await getPostById(postId);
  if (!post) {
    return;
  }

  await query(`DELETE FROM forumPosts WHERE postId = ?`, [postId]);

  await recalculateDiscussionMeta(post.discussionId);
}

async function fetchUserSummaries(userIds) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return new Map();
  }

  const placeholders = uniqueIds.map(() => "?").join(",");

  const userRows = await query(
    `SELECT userId, username, uuid, profilePicture_type, profilePicture_email
       FROM users
      WHERE userId IN (${placeholders})`,
    uniqueIds,
  );

  const summaries = new Map();

  userRows.forEach((row) => {
    let avatarUrl = null;

    if (row.profilePicture_type === "GRAVATAR" && row.profilePicture_email) {
      avatarUrl = null;
    } else if (row.uuid) {
      avatarUrl = `https://crafthead.net/helm/${row.uuid}`;
    }

    summaries.set(row.userId, {
      userId: row.userId,
      username: row.username,
      uuid: row.uuid,
      avatarUrl,
      profilePictureType: row.profilePicture_type,
      profilePictureEmail: row.profilePicture_email,
      ranks: [],
    });
  });

  uniqueIds.forEach((userId) => {
    if (!summaries.has(userId)) {
      summaries.set(userId, {
        userId,
        username: "Unknown", 
        uuid: null,
        avatarUrl: "https://crafthead.net/helm/steve",
        profilePictureType: null,
        profilePictureEmail: null,
        ranks: [],
      });
    }
  });

  const rankRows = await query(
    `SELECT ur.userId,
            ur.rankSlug,
            ur.title,
            r.displayName,
            r.rankBadgeColour,
            r.rankTextColour,
            r.priority
       FROM userRanks ur
       LEFT JOIN ranks r ON r.rankSlug = ur.rankSlug
      WHERE ur.userId IN (${placeholders})
      ORDER BY CAST(COALESCE(r.priority, 0) AS UNSIGNED) DESC, r.rankSlug ASC`,
    uniqueIds,
  );

  rankRows.forEach((row) => {
    const summary = summaries.get(row.userId);
    if (!summary) {
      return;
    }

    summary.ranks.push({
      rankSlug: row.rankSlug,
      displayName: row.displayName || row.rankSlug,
      badgeColour: row.rankBadgeColour || null,
      textColour: row.rankTextColour || null,
      title: row.title || null,
    });
  });

  for (const summary of summaries.values()) {
    if (!summary.avatarUrl) {
      if (
        summary.profilePictureType === "GRAVATAR" &&
        summary.profilePictureEmail
      ) {
        const hash = await hashEmail(summary.profilePictureEmail.trim().toLowerCase());
        summary.avatarUrl = `https://gravatar.com/avatar/${hash}?size=300`;
      } else if (summary.uuid) {
        summary.avatarUrl = `https://crafthead.net/helm/${summary.uuid}`;
      } else {
        summary.avatarUrl = "https://crafthead.net/helm/steve";
      }
    }
  }

  return summaries;
}

export async function getDiscussionPosts(discussionId) {
  const rows = await query(
    `SELECT postId, discussionId, userId, content, isOriginal, createdAt, updatedAt
       FROM forumPosts
      WHERE discussionId = ?
      ORDER BY createdAt ASC, postId ASC`,
    [discussionId],
  );

  const postIds = rows.map((row) => row.postId);
  const userIds = rows.map((row) => row.userId);

  const userSummaries = await fetchUserSummaries(userIds);

  let revisionRows = [];
  if (postIds.length) {
    const placeholders = postIds.map(() => "?").join(",");
    revisionRows = await query(
      `SELECT r.revisionId,
              r.postId,
              r.editorId,
              r.previousContent,
              r.createdAt,
              u.username AS editorUsername
         FROM forumPostRevisions r
         LEFT JOIN users u ON u.userId = r.editorId
        WHERE r.postId IN (${placeholders})
        ORDER BY r.createdAt DESC, r.revisionId DESC`,
      postIds,
    );
  }

  const revisionsByPost = new Map();
  revisionRows.forEach((row) => {
    if (!revisionsByPost.has(row.postId)) {
      revisionsByPost.set(row.postId, []);
    }
    revisionsByPost.get(row.postId).push({
      revisionId: row.revisionId,
      editorId: row.editorId,
      editorUsername: row.editorUsername,
      previousContent: row.previousContent,
      createdAt: row.createdAt,
    });
  });

  return rows.map((row) => {
    return {
      ...row,
      isOriginal: !!row.isOriginal,
      user: userSummaries.get(row.userId) || null,
      revisions: revisionsByPost.get(row.postId) || [],
    };
  });
}

export async function getRecentDiscussions({
  categoryIds = [],
  page = 1,
  perPage = 20,
  includeArchived = false,
}) {
  if (!categoryIds.length) {
    return { discussions: [], total: 0 };
  }

  const placeholders = categoryIds.map(() => "?").join(",");
  const offset = Math.max(0, (page - 1) * perPage);

  const totalRows = await query(
    `SELECT COUNT(*) AS total
       FROM forumDiscussions
      WHERE categoryId IN (${placeholders})
        ${includeArchived ? "" : "AND isArchived = 0"}`,
    categoryIds,
  );

  const total = totalRows?.[0]?.total ? Number(totalRows[0].total) : 0;

  const rows = await query(
    `SELECT d.discussionId,
            d.categoryId,
            d.title,
            d.slug,
            d.createdBy,
            d.createdAt,
            d.updatedAt,
            d.lastPostAt,
            d.lastPostBy,
            d.isLocked,
            d.isSticky,
            d.isArchived,
            c.name AS categoryName,
            c.slug AS categorySlug
       FROM forumDiscussions d
       JOIN forumCategories c ON c.categoryId = d.categoryId
      WHERE d.categoryId IN (${placeholders})
        ${includeArchived ? "" : "AND d.isArchived = 0"}
      ORDER BY d.isSticky DESC, d.lastPostAt DESC, d.discussionId DESC
      LIMIT ? OFFSET ?`,
    [...categoryIds, perPage, offset],
  );

  const discussionIds = rows.map((row) => row.discussionId);
  const userIds = rows.flatMap((row) => [row.createdBy, row.lastPostBy]);

  const replyCounts = new Map();
  if (discussionIds.length) {
    const discussionPlaceholders = discussionIds.map(() => "?").join(",");
    const countRows = await query(
      `SELECT discussionId, COUNT(*) AS postCount
         FROM forumPosts
        WHERE discussionId IN (${discussionPlaceholders})
        GROUP BY discussionId`,
      discussionIds,
    );

    countRows.forEach((row) => {
      const replies = Math.max(0, Number(row.postCount || 0) - 1);
      replyCounts.set(row.discussionId, replies);
    });

    const lastPostRows = await query(
      `SELECT p.discussionId, p.postId, p.userId, p.createdAt
         FROM forumPosts p
        WHERE p.discussionId IN (${discussionPlaceholders})
        ORDER BY p.discussionId ASC, p.createdAt DESC, p.postId DESC`,
      discussionIds,
    );

    const latestPostMap = new Map();
    lastPostRows.forEach((row) => {
      if (!latestPostMap.has(row.discussionId)) {
        latestPostMap.set(row.discussionId, row);
        userIds.push(row.userId);
      }
    });

    rows.forEach((row) => {
      const latest = latestPostMap.get(row.discussionId);
      if (latest) {
        row.latestPost = latest;
      }
    });
  }

  const userSummaries = await fetchUserSummaries(userIds);

  const discussions = rows.map((row) => {
    const author = userSummaries.get(row.createdBy) || null;
    const lastPostUserId = row.latestPost?.userId || row.lastPostBy;
    const lastPoster = lastPostUserId ? userSummaries.get(lastPostUserId) : null;

    return {
      ...mapDiscussionRow(row),
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      replyCount: replyCounts.get(row.discussionId) ?? 0,
      latestPost: row.latestPost
        ? {
            postId: row.latestPost.postId,
            createdAt: row.latestPost.createdAt,
            user: lastPoster,
          }
        : null,
      author,
    };
  });

  return { discussions, total };
}

export async function getCategoryDiscussions({
  categoryId,
  page = 1,
  perPage = 20,
  includeArchived = false,
}) {
  if (!categoryId) {
    return { discussions: [], total: 0 };
  }

  return getRecentDiscussions({
    categoryIds: [categoryId],
    page,
    perPage,
    includeArchived,
  });
}

export async function setDiscussionFlags(discussionId, flags = {}) {
  const updates = [];
  const params = [];

  if (flags.isLocked !== undefined) {
    updates.push("isLocked = ?");
    params.push(flags.isLocked ? 1 : 0);
  }

  if (flags.isSticky !== undefined) {
    updates.push("isSticky = ?");
    params.push(flags.isSticky ? 1 : 0);
  }

  if (flags.isArchived !== undefined) {
    updates.push("isArchived = ?");
    params.push(flags.isArchived ? 1 : 0);
  }

  if (!updates.length) {
    return getDiscussionRow(discussionId);
  }

  params.push(discussionId);

  await query(
    `UPDATE forumDiscussions
        SET ${updates.join(",")},
            updatedAt = NOW()
      WHERE discussionId = ?`,
    params,
  );

  return getDiscussionRow(discussionId);
}

export async function getPostRevisions(postId) {
  return query(
    `SELECT r.revisionId,
            r.postId,
            r.editorId,
            r.previousContent,
            r.createdAt,
            u.username AS editorUsername
       FROM forumPostRevisions r
       LEFT JOIN users u ON u.userId = r.editorId
      WHERE r.postId = ?
      ORDER BY r.createdAt DESC, r.revisionId DESC`,
    [postId],
  );
}
