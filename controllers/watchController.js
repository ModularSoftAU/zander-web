import db from "./databaseController.js";
import { getUserPermissions } from "./userController.js";
import { hasPermission } from "../lib/discord/permissions.mjs";

const CREATOR_PERMISSION_NODE = "zander.watch.creator";

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

// ---------------------------------------------------------------------------
// Platform connections
// ---------------------------------------------------------------------------

export function getPlatformConnection(userId, platform) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM user_platform_connections WHERE user_id=? AND platform=? LIMIT 1`,
      [userId, platform],
      (error, results) => {
        if (error) return reject(error);
        resolve(results?.[0] || null);
      }
    );
  });
}

export function getPlatformConnectionsByUserId(userId) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM user_platform_connections WHERE user_id=?`,
      [userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results || []);
      }
    );
  });
}

export function upsertPlatformConnection(userId, platform, data) {
  const {
    platform_account_id,
    platform_channel_id = null,
    platform_username = null,
    platform_display_name = null,
    avatar_url = null,
    access_token = null,
    refresh_token = null,
    token_expires_at = null,
  } = data;

  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO user_platform_connections
         (user_id, platform, platform_account_id, platform_channel_id, platform_username,
          platform_display_name, avatar_url, access_token, refresh_token, token_expires_at,
          is_active, last_sync_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)
       ON DUPLICATE KEY UPDATE
         platform_account_id=VALUES(platform_account_id),
         platform_channel_id=VALUES(platform_channel_id),
         platform_username=VALUES(platform_username),
         platform_display_name=VALUES(platform_display_name),
         avatar_url=VALUES(avatar_url),
         access_token=VALUES(access_token),
         refresh_token=VALUES(refresh_token),
         token_expires_at=VALUES(token_expires_at),
         is_active=1,
         last_sync_error=NULL,
         updated_at=CURRENT_TIMESTAMP`,
      [
        userId, platform, platform_account_id, platform_channel_id,
        platform_username, platform_display_name, avatar_url,
        access_token, refresh_token, token_expires_at,
      ],
      (error) => {
        if (error) return reject(error);
        resolve(true);
      }
    );
  });
}

export function deactivatePlatformConnection(userId, platform) {
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE user_platform_connections SET is_active=0, access_token=NULL, refresh_token=NULL, updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND platform=?`,
      [userId, platform],
      (error) => {
        if (error) return reject(error);
        resolve(true);
      }
    );
  });
}

export function updateSyncStatus(userId, platform, { success, error = null } = {}) {
  return new Promise((resolve, reject) => {
    if (success) {
      db.query(
        `UPDATE user_platform_connections SET last_successful_sync_at=CURRENT_TIMESTAMP, last_sync_error=NULL WHERE user_id=? AND platform=?`,
        [userId, platform],
        (err) => { if (err) return reject(err); resolve(true); }
      );
    } else {
      db.query(
        `UPDATE user_platform_connections SET last_sync_error=? WHERE user_id=? AND platform=?`,
        [error ? String(error).substring(0, 255) : "Unknown error", userId, platform],
        (err) => { if (err) return reject(err); resolve(true); }
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Content items
// ---------------------------------------------------------------------------

export function upsertContentItem(data) {
  const {
    user_id,
    platform,
    external_content_id,
    external_channel_id = null,
    content_type,
    title = null,
    description = null,
    thumbnail_url = null,
    watch_url = null,
    viewer_count = null,
    tags_json = null,
    is_live = 0,
    published_at = null,
    started_at = null,
    ended_at = null,
    matched_rule = null,
    is_cfc_related = 0,
    is_publicly_visible = 0,
  } = data;

  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO creator_content_items
         (user_id, platform, external_content_id, external_channel_id, content_type,
          title, description, thumbnail_url, watch_url, viewer_count, tags_json, is_live,
          published_at, started_at, ended_at, matched_rule, is_cfc_related,
          is_publicly_visible, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         user_id=VALUES(user_id),
         external_channel_id=VALUES(external_channel_id),
         content_type=VALUES(content_type),
         title=VALUES(title),
         description=VALUES(description),
         thumbnail_url=VALUES(thumbnail_url),
         watch_url=VALUES(watch_url),
         viewer_count=VALUES(viewer_count),
         tags_json=VALUES(tags_json),
         is_live=VALUES(is_live),
         published_at=VALUES(published_at),
         started_at=VALUES(started_at),
         ended_at=VALUES(ended_at),
         matched_rule=VALUES(matched_rule),
         is_cfc_related=VALUES(is_cfc_related),
         is_publicly_visible=VALUES(is_publicly_visible),
         last_seen_at=CURRENT_TIMESTAMP,
         updated_at=CURRENT_TIMESTAMP`,
      [
        user_id, platform, external_content_id, external_channel_id, content_type,
        title, description, thumbnail_url, watch_url, viewer_count, tags_json, is_live,
        published_at, started_at, ended_at, matched_rule, is_cfc_related, is_publicly_visible,
      ],
      (error) => {
        if (error) return reject(error);
        resolve(true);
      }
    );
  });
}

export function markStreamsOffline(platform, excludeContentIds = []) {
  if (excludeContentIds.length === 0) {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE creator_content_items SET is_live=0, ended_at=CURRENT_TIMESTAMP, is_publicly_visible=0, updated_at=CURRENT_TIMESTAMP WHERE platform=? AND is_live=1`,
        [platform],
        (error) => { if (error) return reject(error); resolve(true); }
      );
    });
  }

  const placeholders = excludeContentIds.map(() => "?").join(",");
  return new Promise((resolve, reject) => {
    db.query(
      `UPDATE creator_content_items SET is_live=0, ended_at=CURRENT_TIMESTAMP, is_publicly_visible=0, updated_at=CURRENT_TIMESTAMP WHERE platform=? AND is_live=1 AND external_content_id NOT IN (${placeholders})`,
      [platform, ...excludeContentIds],
      (error) => { if (error) return reject(error); resolve(true); }
    );
  });
}

export function getPublicLiveContent() {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT cci.*, u.username FROM creator_content_items cci
       JOIN users u ON u.userId = cci.user_id
       WHERE cci.is_publicly_visible=1 AND cci.is_live=1
       ORDER BY cci.started_at DESC
       LIMIT 50`,
      [],
      (error, results) => {
        if (error) return reject(error);
        resolve(results || []);
      }
    );
  });
}

export function getPublicVideoContent(limit = 20, offset = 0) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT cci.*, u.username FROM creator_content_items cci
       JOIN users u ON u.userId = cci.user_id
       WHERE cci.is_publicly_visible=1 AND cci.content_type='video' AND cci.is_live=0
       ORDER BY cci.published_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
      (error, results) => {
        if (error) return reject(error);
        resolve(results || []);
      }
    );
  });
}

export function getPublicVideoCount() {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT COUNT(*) AS total FROM creator_content_items
       WHERE is_publicly_visible=1 AND content_type='video' AND is_live=0`,
      [],
      (error, results) => {
        if (error) return reject(error);
        resolve(results?.[0]?.total || 0);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Notification deduplication
// ---------------------------------------------------------------------------

export function hasNotificationBeenSent(platform, externalContentId, notificationType) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT id FROM creator_content_notifications WHERE platform=? AND external_content_id=? AND notification_type=? LIMIT 1`,
      [platform, externalContentId, notificationType],
      (error, results) => {
        if (error) return reject(error);
        resolve(results?.length > 0);
      }
    );
  });
}

export function recordNotification(platform, externalContentId, notificationType, discordMessageId = null) {
  return new Promise((resolve, reject) => {
    db.query(
      `INSERT IGNORE INTO creator_content_notifications (platform, external_content_id, notification_type, discord_message_id) VALUES (?, ?, ?, ?)`,
      [platform, externalContentId, notificationType, discordMessageId],
      (error) => { if (error) return reject(error); resolve(true); }
    );
  });
}

// ---------------------------------------------------------------------------
// Eligibility helpers used by cron jobs
// ---------------------------------------------------------------------------

/**
 * Returns all users with an active platform connection who also hold the
 * zander.watch.creator permission node.
 */
export async function getEligibleCreators(platform) {
  const rows = await runQuery(
    `SELECT upc.*, u.userId, u.username, u.uuid
     FROM user_platform_connections upc
     JOIN users u ON u.userId = upc.user_id
     WHERE upc.platform=? AND upc.is_active=1 AND u.account_disabled IS NOT TRUE`,
    [platform]
  );

  console.log(`[Watch] getEligibleCreators(${platform}): ${rows.length} active connection(s) found.`);

  const eligible = [];
  for (const row of rows) {
    try {
      const perms = await getUserPermissions({ userId: row.userId, uuid: row.uuid, username: row.username });
      const hasCreatorPerm = hasPermission(perms, CREATOR_PERMISSION_NODE);
      console.log(`[Watch] userId=${row.userId} (${row.username}): ${hasCreatorPerm ? "has" : "MISSING"} ${CREATOR_PERMISSION_NODE}`);
      if (hasCreatorPerm) {
        eligible.push(row);
      }
    } catch (err) {
      console.error(`[Watch] Permission check failed for user ${row.userId}:`, err);
    }
  }

  console.log(`[Watch] getEligibleCreators(${platform}): ${eligible.length}/${rows.length} creator(s) eligible.`);
  return eligible;
}

// ---------------------------------------------------------------------------
// CFC content filtering
// ---------------------------------------------------------------------------

/**
 * Returns the matched rule string if the content matches CFC markers, or null.
 * Config shape:
 *   config.watch.filters.twitch.titleMarkers  (array of lowercase strings)
 *   config.watch.filters.twitch.tags           (array of lowercase strings)
 *   config.watch.filters.youtube.tags          (array of lowercase strings)
 *   config.watch.filters.youtube.descriptionMarkers (array of lowercase strings)
 */
export function matchesCfcFilter(platform, { title = "", description = "", tags = [] }, config) {
  const filterCfg = config?.watch?.filters?.[platform] || {};
  const titleLower = String(title || "").toLowerCase();
  const descLower = String(description || "").toLowerCase();
  const tagsLower = (Array.isArray(tags) ? tags : []).map((t) => String(t).toLowerCase());

  if (platform === "twitch") {
    const titleMarkers = filterCfg.titleMarkers || ["#cfc", "[cfc]"];
    for (const marker of titleMarkers) {
      if (titleLower.includes(marker.toLowerCase())) {
        return `title:${marker}`;
      }
    }
    const tagMarkers = filterCfg.tags || ["cfc"];
    for (const marker of tagMarkers) {
      if (tagsLower.some((t) => t === marker.toLowerCase())) {
        return `tag:${marker}`;
      }
    }
  }

  if (platform === "youtube") {
    const tagMarkers = filterCfg.tags || ["cfc"];
    for (const marker of tagMarkers) {
      if (tagsLower.some((t) => t === marker.toLowerCase())) {
        return `tag:${marker}`;
      }
    }
    const descMarkers = filterCfg.descriptionMarkers || ["#cfc"];
    for (const marker of descMarkers) {
      if (descLower.includes(marker.toLowerCase())) {
        return `description:${marker}`;
      }
    }
  }

  return null;
}
