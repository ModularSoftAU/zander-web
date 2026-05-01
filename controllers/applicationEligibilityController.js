import db from "./databaseController.js";
export { evaluateEligibilityRules } from "./applicationEligibilityRules.js";

const executeQuery = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.query(query, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });

// ─── Rules CRUD ─────────────────────────────────────────────────────────────

export async function getEligibilityRules(applicationFormId) {
  const rows = await executeQuery(
    `SELECT * FROM application_eligibility_rules WHERE application_form_id = ? LIMIT 1`,
    [applicationFormId]
  );
  return rows[0] || null;
}

export async function saveEligibilityRules(applicationFormId, rules) {
  const {
    minimum_playtime_hours = null,
    block_if_currently_banned = false,
    block_if_ever_banned = false,
    punishment_lookback_months = null,
    max_punishments_in_lookback = null,
    block_if_banned_on_any_platform = false,
    require_discord_activity = false,
    discord_activity_lookback_days = null,
    minimum_discord_messages = null,
  } = rules;

  await executeQuery(
    `INSERT INTO application_eligibility_rules
       (application_form_id, minimum_playtime_hours, block_if_currently_banned,
        block_if_ever_banned, punishment_lookback_months, max_punishments_in_lookback,
        block_if_banned_on_any_platform, require_discord_activity,
        discord_activity_lookback_days, minimum_discord_messages)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       minimum_playtime_hours          = VALUES(minimum_playtime_hours),
       block_if_currently_banned       = VALUES(block_if_currently_banned),
       block_if_ever_banned            = VALUES(block_if_ever_banned),
       punishment_lookback_months      = VALUES(punishment_lookback_months),
       max_punishments_in_lookback     = VALUES(max_punishments_in_lookback),
       block_if_banned_on_any_platform = VALUES(block_if_banned_on_any_platform),
       require_discord_activity        = VALUES(require_discord_activity),
       discord_activity_lookback_days  = VALUES(discord_activity_lookback_days),
       minimum_discord_messages        = VALUES(minimum_discord_messages),
       updated_at                      = NOW()`,
    [
      applicationFormId,
      minimum_playtime_hours,
      block_if_currently_banned ? 1 : 0,
      block_if_ever_banned ? 1 : 0,
      punishment_lookback_months,
      max_punishments_in_lookback,
      block_if_banned_on_any_platform ? 1 : 0,
      require_discord_activity ? 1 : 0,
      discord_activity_lookback_days,
      minimum_discord_messages,
    ]
  );
}

export async function deleteEligibilityRules(applicationFormId) {
  await executeQuery(
    `DELETE FROM application_eligibility_rules WHERE application_form_id = ?`,
    [applicationFormId]
  );
}

// ─── Data Sources ────────────────────────────────────────────────────────────

export async function getPlaytimeHours(userId) {
  const rows = await executeQuery(
    `SELECT SUM(TIME_TO_SEC(TIMEDIFF(COALESCE(sessionEnd, NOW()), sessionStart))) AS totalSeconds
     FROM gameSessions WHERE userId = ?`,
    [userId]
  );
  const seconds = rows[0]?.totalSeconds || 0;
  return Math.floor(seconds / 3600);
}

export async function getPlatformBanStatus(userId) {
  const sources = [];

  // Fetch user record for discordId
  const userRows = await executeQuery(
    `SELECT discordId FROM users WHERE userId = ? LIMIT 1`,
    [userId]
  );
  const discordId = userRows[0]?.discordId || null;

  const conditions = [`dp.target_player_id = ?`];
  const params = [userId];

  if (discordId) {
    conditions.push(`dp.target_discord_user_id = ?`);
    params.push(discordId);
  }

  const activeBans = await executeQuery(
    `SELECT dp.platform, dp.type FROM discord_punishments dp
     WHERE (${conditions.join(" OR ")})
       AND dp.type IN ('TEMP_BAN', 'PERM_BAN')
       AND dp.status = 'ACTIVE'`,
    params
  );

  for (const ban of activeBans) {
    const platform = (ban.platform || "DISCORD").toLowerCase();
    if (!sources.includes(platform)) {
      sources.push(platform);
    }
  }

  return {
    banned: sources.length > 0,
    sources,
  };
}

export async function isCurrentlyBanned(userId) {
  const status = await getPlatformBanStatus(userId);
  return status.banned;
}

export async function hasEverBeenBanned(userId) {
  const userRows = await executeQuery(
    `SELECT discordId FROM users WHERE userId = ? LIMIT 1`,
    [userId]
  );
  const discordId = userRows[0]?.discordId || null;

  const conditions = [`target_player_id = ?`];
  const params = [userId];

  if (discordId) {
    conditions.push(`target_discord_user_id = ?`);
    params.push(discordId);
  }

  const rows = await executeQuery(
    `SELECT id FROM discord_punishments
     WHERE (${conditions.join(" OR ")})
       AND type IN ('TEMP_BAN', 'PERM_BAN')
     LIMIT 1`,
    params
  );
  return rows.length > 0;
}

export async function getPunishmentsInLookback(userId, lookbackMonths) {
  const userRows = await executeQuery(
    `SELECT discordId FROM users WHERE userId = ? LIMIT 1`,
    [userId]
  );
  const discordId = userRows[0]?.discordId || null;

  const conditions = [`target_player_id = ?`];
  const params = [userId];

  if (discordId) {
    conditions.push(`target_discord_user_id = ?`);
    params.push(discordId);
  }

  params.push(lookbackMonths);

  const rows = await executeQuery(
    `SELECT COUNT(*) AS total FROM discord_punishments
     WHERE (${conditions.join(" OR ")})
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)`,
    params
  );
  return rows[0]?.total || 0;
}

export async function getDiscordActivity(userId, lookbackDays) {
  const rows = await executeQuery(
    `SELECT COUNT(*) AS total FROM discord_activity_log
     WHERE user_id = ?
       AND occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [userId, lookbackDays]
  );
  return rows[0]?.total || 0;
}

export async function hasLinkedDiscordAccount(userId) {
  const rows = await executeQuery(
    `SELECT discordId FROM users WHERE userId = ? AND discordId IS NOT NULL LIMIT 1`,
    [userId]
  );
  return rows.length > 0;
}

export async function hasLinkedMinecraftAccount(userId) {
  const rows = await executeQuery(
    `SELECT uuid FROM users WHERE userId = ? AND uuid IS NOT NULL LIMIT 1`,
    [userId]
  );
  return rows.length > 0;
}

// ─── Core Eligibility Checker ────────────────────────────────────────────────

/**
 * Check whether a user is eligible to submit an application.
 *
 * @param {number} userId
 * @param {number} applicationFormId  The applications.applicationId value.
 * @param {{ override?: boolean }} options
 * @returns {{ eligible: boolean, failedRules: Array<{code: string, message: string}>, snapshot: object }}
 */
export async function checkApplicationEligibility(userId, applicationFormId, options = {}) {
  const rules = await getEligibilityRules(applicationFormId);

  if (!rules) {
    return {
      eligible: true,
      failedRules: [],
      snapshot: {
        playtime_hours: null, currently_banned: null, ever_banned: null,
        punishments_in_lookback: null, platform_ban_sources: null, discord_message_count: null,
      },
    };
  }

  // Fetch only the data needed by the active rules
  const data = {
    hasMinecraftAccount: false,
    playtimeHours: 0,
    currentlyBanned: false,
    everBanned: false,
    punishmentsInLookback: 0,
    platformBanned: false,
    platformBanSources: [],
    hasDiscordAccount: false,
    discordMessageCount: 0,
  };

  if (rules.minimum_playtime_hours !== null) {
    data.hasMinecraftAccount = await hasLinkedMinecraftAccount(userId);
    if (data.hasMinecraftAccount) {
      data.playtimeHours = await getPlaytimeHours(userId);
    }
  }

  if (rules.block_if_currently_banned || rules.block_if_banned_on_any_platform) {
    const platformStatus = await getPlatformBanStatus(userId);
    data.currentlyBanned = platformStatus.banned;
    data.platformBanned = platformStatus.banned;
    data.platformBanSources = platformStatus.sources;
  }

  if (rules.block_if_ever_banned) {
    data.everBanned = await hasEverBeenBanned(userId);
  }

  if (rules.punishment_lookback_months !== null) {
    data.punishmentsInLookback = await getPunishmentsInLookback(userId, rules.punishment_lookback_months);
  }

  if (rules.require_discord_activity) {
    data.hasDiscordAccount = await hasLinkedDiscordAccount(userId);
    if (data.hasDiscordAccount) {
      const lookbackDays = rules.discord_activity_lookback_days ?? 30;
      data.discordMessageCount = await getDiscordActivity(userId, lookbackDays);
    }
  }

  return evaluateEligibilityRules(rules, data);
}

// ─── Eligibility Snapshots ───────────────────────────────────────────────────

export async function saveEligibilitySnapshot({
  formResponseId,
  applicationFormId,
  userId,
  eligible,
  failedRules,
  snapshot,
  overrideByUserId = null,
}) {
  await executeQuery(
    `INSERT INTO application_eligibility_snapshots
       (form_response_id, application_form_id, user_id, eligible, failed_rules,
        playtime_hours, currently_banned, ever_banned, punishments_in_lookback,
        platform_ban_sources, discord_message_count, override_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      formResponseId,
      applicationFormId,
      userId,
      eligible ? 1 : 0,
      JSON.stringify(failedRules),
      snapshot.playtime_hours,
      snapshot.currently_banned,
      snapshot.ever_banned,
      snapshot.punishments_in_lookback,
      snapshot.platform_ban_sources ? JSON.stringify(snapshot.platform_ban_sources) : null,
      snapshot.discord_message_count,
      overrideByUserId,
    ]
  );
}

export async function getEligibilitySnapshotByResponse(formResponseId) {
  const rows = await executeQuery(
    `SELECT * FROM application_eligibility_snapshots WHERE form_response_id = ? LIMIT 1`,
    [formResponseId]
  );
  return rows[0] || null;
}

// ─── Override Audit Log ──────────────────────────────────────────────────────

export async function createEligibilityOverride({
  staffUserId,
  applicantUserId,
  applicationFormId,
  failedRules,
}) {
  await executeQuery(
    `INSERT INTO application_eligibility_overrides
       (staff_user_id, applicant_user_id, application_form_id, failed_rules)
     VALUES (?, ?, ?, ?)`,
    [staffUserId, applicantUserId, applicationFormId, JSON.stringify(failedRules)]
  );
}

export async function getEligibilityOverrides(applicationFormId) {
  return executeQuery(
    `SELECT aeo.*, u.username AS staff_username, a.username AS applicant_username
     FROM application_eligibility_overrides aeo
     LEFT JOIN users u ON aeo.staff_user_id = u.userId
     LEFT JOIN users a ON aeo.applicant_user_id = a.userId
     WHERE aeo.application_form_id = ?
     ORDER BY aeo.created_at DESC`,
    [applicationFormId]
  );
}

// ─── Application Lookup ──────────────────────────────────────────────────────

export async function getApplicationByLinkedFormId(formId) {
  const rows = await executeQuery(
    `SELECT applicationId FROM applications WHERE linkedFormId = ? AND applicationType = 'linked_form' LIMIT 1`,
    [formId]
  );
  return rows[0] || null;
}

// ─── Discord Activity Logging ────────────────────────────────────────────────

export async function logDiscordActivity({ userId, discordUserId, channelId, activityType = "message" }) {
  if (!userId && !discordUserId) return;

  let resolvedUserId = userId;

  if (!resolvedUserId && discordUserId) {
    const rows = await executeQuery(
      `SELECT userId FROM users WHERE discordId = ? LIMIT 1`,
      [discordUserId]
    );
    if (rows.length) {
      resolvedUserId = rows[0].userId;
    }
  }

  if (!resolvedUserId) return;

  await executeQuery(
    `INSERT INTO discord_activity_log (user_id, discord_user_id, channel_id, activity_type)
     VALUES (?, ?, ?, ?)`,
    [resolvedUserId, discordUserId || null, channelId || null, activityType]
  );
}
