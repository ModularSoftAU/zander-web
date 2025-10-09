import { isFeatureEnabled, optional } from "../common.js";
import {
  UserGetter,
  getUserPermissions,
} from "../../controllers/userController.js";

const RANK_SETTINGS_TABLE = "rankSettings";
const LUCKPERMS_USER_PERMISSIONS_TABLE =
  "cfcdev_luckperms.luckperms_user_permissions";

function parseBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }
  return false;
}

function normalizeColour(value) {
  if (!value) return null;
  let trimmed = value.trim().replace(/[^0-9a-fA-F#]/g, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) {
    trimmed = trimmed.substring(1);
  }

  if (trimmed.length === 3) {
    trimmed = trimmed
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }

  if (trimmed.length < 6) {
    return null;
  }

  return `#${trimmed.substring(0, 6)}`.toLowerCase();
}

function buildRankRow(row) {
  const priorityValue = row.overridePriority ?? row.basePriority ?? 0;
  const isStaffOverride =
    row.overrideIsStaff === null || row.overrideIsStaff === undefined
      ? null
      : row.overrideIsStaff;
  const isDonatorOverride =
    row.overrideIsDonator === null || row.overrideIsDonator === undefined
      ? null
      : row.overrideIsDonator;

  return {
    rankSlug: row.rankSlug,
    displayName: row.overrideDisplayName || row.baseDisplayName,
    priority: priorityValue !== null ? Number(priorityValue) : null,
    rankBadgeColour: row.overrideRankBadgeColour || row.baseRankBadgeColour,
    rankTextColour: row.overrideRankTextColour || row.baseRankTextColour,
    discordRoleId: row.overrideDiscordRoleId || row.baseDiscordRoleId,
    isStaff: Number(
      parseBoolean(
        isStaffOverride !== null ? isStaffOverride : row.baseIsStaff
      )
    ),
    isDonator: Number(
      parseBoolean(
        isDonatorOverride !== null ? isDonatorOverride : row.baseIsDonator
      )
    ),
    base: {
      displayName: row.baseDisplayName,
      priority:
        row.basePriority !== null && row.basePriority !== undefined
          ? Number(row.basePriority)
          : null,
      rankBadgeColour: row.baseRankBadgeColour,
      rankTextColour: row.baseRankTextColour,
      discordRoleId: row.baseDiscordRoleId,
      isStaff: Number(parseBoolean(row.baseIsStaff)),
      isDonator: Number(parseBoolean(row.baseIsDonator)),
    },
    overrides: {
      displayName: row.overrideDisplayName,
      priority:
        row.overridePriority !== null && row.overridePriority !== undefined
          ? Number(row.overridePriority)
          : null,
      rankBadgeColour: row.overrideRankBadgeColour,
      rankTextColour: row.overrideRankTextColour,
      discordRoleId: row.overrideDiscordRoleId,
      isStaff:
        isStaffOverride !== null && isStaffOverride !== undefined
          ? Number(parseBoolean(isStaffOverride))
          : null,
      isDonator:
        isDonatorOverride !== null && isDonatorOverride !== undefined
          ? Number(parseBoolean(isDonatorOverride))
          : null,
      updatedAt: row.updatedAt || null,
      updatedBy: row.updatedBy || null,
    },
    updatedAt: row.updatedAt || null,
    updatedBy: row.updatedBy || null,
  };
}

export default function rankApiRoute(app, config, db, features, lang) {
  const baseEndpoint = "/api/rank";

  const queryDb = (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.query(query, params, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  };

  const rankSelectColumns = `
    r.rankSlug,
    r.displayName AS baseDisplayName,
    r.priority AS basePriority,
    r.rankBadgeColour AS baseRankBadgeColour,
    r.rankTextColour AS baseRankTextColour,
    r.discordRoleId AS baseDiscordRoleId,
    r.isStaff AS baseIsStaff,
    r.isDonator AS baseIsDonator,
    rs.displayName AS overrideDisplayName,
    rs.priority AS overridePriority,
    rs.rankBadgeColour AS overrideRankBadgeColour,
    rs.rankTextColour AS overrideRankTextColour,
    rs.discordRoleId AS overrideDiscordRoleId,
    rs.isStaff AS overrideIsStaff,
    rs.isDonator AS overrideIsDonator,
    rs.updatedAt,
    rs.updatedBy
  `;

  async function resolvePlayer(username) {
    if (!username) {
      return null;
    }

    const trimmedUsername = String(username).trim();
    if (!trimmedUsername) {
      return null;
    }

    const [webUser] = await queryDb(
      `SELECT userId, username, uuid FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1`,
      [trimmedUsername]
    );

    const [luckPermsUser] = await queryDb(
      `SELECT username, uuid FROM luckPermsPlayers WHERE LOWER(username)=LOWER(?) LIMIT 1`,
      [trimmedUsername]
    );

    if (!webUser && !luckPermsUser) {
      return null;
    }

    return {
      userId: webUser?.userId ?? null,
      username: webUser?.username || luckPermsUser?.username || trimmedUsername,
      uuid: webUser?.uuid || luckPermsUser?.uuid || null,
    };
  }

  function permissionMatch(permissions, node) {
    if (!Array.isArray(permissions) || !node) {
      return false;
    }

    const requested = node.trim();
    if (!requested) {
      return false;
    }

    return permissions.some((permission) => {
      if (!permission) return false;
      if (permission === "*") return true;
      if (permission === requested) return true;
      if (permission.endsWith(".*")) {
        const base = permission.slice(0, -1);
        return requested.startsWith(base);
      }
      return false;
    });
  }

  app.get(`${baseEndpoint}/get`, async function (req, res) {
    isFeatureEnabled(features.ranks, res, lang);
    const username = optional(req.query, "username");
    const rank = optional(req.query, "rank");

    try {
      if (username) {
        const player = await resolvePlayer(username);

        if (!player || !player.uuid) {
          return res.send({
            success: false,
            message: "Player not found.",
          });
        }

        const results = await queryDb(
          `
            SELECT
              ${rankSelectColumns},
              ur.title
            FROM userRanks ur
              JOIN ranks r ON ur.rankSlug = r.rankSlug
              LEFT JOIN ${RANK_SETTINGS_TABLE} rs ON rs.rankSlug = r.rankSlug
            WHERE ur.uuid = ?
            ORDER BY CAST(COALESCE(rs.priority, r.priority) AS UNSIGNED) DESC,
              r.rankSlug
          `,
          [player.uuid]
        );

        const mapped = results.map((row) => ({
          ...buildRankRow(row),
          title: row.title || null,
        }));

        return res.send({
          success: true,
          data: mapped,
          user: player,
        });
      }

      if (rank) {
        const results = await queryDb(
          `
            SELECT
              u.userId,
              lpPlayers.uuid,
              COALESCE(u.username, lpPlayers.username) AS username,
              COALESCE(rs.displayName, r.displayName) AS displayName,
              COALESCE(rs.rankBadgeColour, r.rankBadgeColour) AS rankBadgeColour,
              COALESCE(rs.rankTextColour, r.rankTextColour) AS rankTextColour,
              ur.title
            FROM ranks r
              JOIN userRanks ur ON ur.rankSlug = r.rankSlug
              JOIN luckPermsPlayers lpPlayers ON ur.uuid = lpPlayers.uuid
              LEFT JOIN users u ON lpPlayers.uuid = u.uuid
              LEFT JOIN ${RANK_SETTINGS_TABLE} rs ON rs.rankSlug = r.rankSlug
            WHERE r.rankSlug = ?
            ORDER BY COALESCE(rs.displayName, r.displayName)
          `,
          [rank]
        );

        return res.send({
          success: true,
          data: results,
        });
      }

      const results = await queryDb(
        `
          SELECT
            ${rankSelectColumns}
          FROM ranks r
            LEFT JOIN ${RANK_SETTINGS_TABLE} rs ON rs.rankSlug = r.rankSlug
          ORDER BY CAST(COALESCE(rs.priority, r.priority) AS UNSIGNED) DESC,
            r.rankSlug
        `
      );

      const mapped = results.map((row) => ({
        ...buildRankRow(row),
      }));

      return res.send({
        success: true,
        data: mapped,
      });
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  app.get(`${baseEndpoint}/user`, async function (req, res) {
    isFeatureEnabled(features.ranks, res, lang);
    const username = optional(req.query, "username");

    if (!username) {
      return res.send({
        success: false,
        message: "Username is required.",
      });
    }

    try {
      const player = await resolvePlayer(username);

      if (!player || !player.uuid) {
        return res.send({
          success: false,
          message: "Player not found.",
        });
      }

      const ranks = await queryDb(
        `
          SELECT
            ${rankSelectColumns},
            ur.title
          FROM userRanks ur
            JOIN ranks r ON ur.rankSlug = r.rankSlug
            LEFT JOIN ${RANK_SETTINGS_TABLE} rs ON rs.rankSlug = r.rankSlug
          WHERE ur.uuid = ?
          ORDER BY CAST(COALESCE(rs.priority, r.priority) AS UNSIGNED) DESC,
            r.rankSlug
        `,
        [player.uuid]
      );

      const mappedRanks = ranks.map((row) => ({
        ...buildRankRow(row),
        title: row.title || null,
      }));

      return res.send({
        success: true,
        data: {
          user: player,
          ranks: mappedRanks,
        },
      });
    } catch (error) {
      return res.send({
        success: false,
        message: `${error}`,
      });
    }
  });

  app.post(`${baseEndpoint}/config/:rankSlug`, async function (req, res) {
    isFeatureEnabled(features.ranks, res, lang);

    const rankSlug = req.params.rankSlug;
    const {
      displayName,
      rankBadgeColour,
      rankTextColour,
      priority,
      discordRoleId,
      isStaff,
      isDonator,
      actor,
    } = req.body || {};

    if (!rankSlug) {
      return res.send({ success: false, message: "Rank slug is required." });
    }

    try {
      const sanitizedBadge = normalizeColour(rankBadgeColour);
      const sanitizedText = normalizeColour(rankTextColour);
      const parsedPriority =
        priority !== undefined && priority !== null && priority !== ""
          ? Number(priority)
          : null;

      await queryDb(
        `
          INSERT INTO ${RANK_SETTINGS_TABLE}
            (rankSlug, displayName, rankBadgeColour, rankTextColour, priority, discordRoleId, isStaff, isDonator, updatedBy)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            displayName = VALUES(displayName),
            rankBadgeColour = VALUES(rankBadgeColour),
            rankTextColour = VALUES(rankTextColour),
            priority = VALUES(priority),
            discordRoleId = VALUES(discordRoleId),
            isStaff = VALUES(isStaff),
            isDonator = VALUES(isDonator),
            updatedBy = VALUES(updatedBy)
        `,
        [
          rankSlug,
          displayName ?? null,
          sanitizedBadge,
          sanitizedText,
          parsedPriority,
          discordRoleId ?? null,
          isStaff === undefined || isStaff === null
            ? null
            : parseBoolean(isStaff)
            ? 1
            : 0,
          isDonator === undefined || isDonator === null
            ? null
            : parseBoolean(isDonator)
            ? 1
            : 0,
          actor || null,
        ]
      );

      const [updatedRank] = await queryDb(
        `
          SELECT
            ${rankSelectColumns}
          FROM ranks r
            LEFT JOIN ${RANK_SETTINGS_TABLE} rs ON rs.rankSlug = r.rankSlug
          WHERE r.rankSlug = ?
        `,
        [rankSlug]
      );

      return res.send({
        success: true,
        message: "Rank configuration updated.",
        data: buildRankRow(updatedRank),
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  app.post(`${baseEndpoint}/config/:rankSlug/reset`, async function (req, res) {
    isFeatureEnabled(features.ranks, res, lang);
    const rankSlug = req.params.rankSlug;

    if (!rankSlug) {
      return res.send({ success: false, message: "Rank slug is required." });
    }

    try {
      await queryDb(
        `DELETE FROM ${RANK_SETTINGS_TABLE} WHERE rankSlug = ? LIMIT 1`,
        [rankSlug]
      );

      return res.send({
        success: true,
        message: "Rank configuration reset to defaults.",
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  app.post(`${baseEndpoint}/user/assign`, async function (req, res) {
    isFeatureEnabled(features.ranks, res, lang);

    const { username, rankSlug, title, actor } = req.body || {};

    if (!username || !rankSlug) {
      return res.send({
        success: false,
        message: "Username and rankSlug are required.",
      });
    }

    try {
      const player = await resolvePlayer(username);

      if (!player || !player.uuid) {
        return res.send({ success: false, message: "Player not found." });
      }

      const [existing] = await queryDb(
        `
          SELECT uuid FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ? AND permission = ? AND value = 1 LIMIT 1
        `,
        [player.uuid, `group.${rankSlug}`]
      );

      if (existing) {
        return res.send({
          success: false,
          message: "Player already has this rank.",
        });
      }

      await queryDb(
        `
          INSERT INTO ${LUCKPERMS_USER_PERMISSIONS_TABLE}
            (uuid, permission, value, server, world, expiry, contexts)
          VALUES (?, ?, 1, 'global', 'global', 0, '[]')
        `,
        [player.uuid, `group.${rankSlug}`]
      );

      await queryDb(
        `
          DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ?
            AND permission LIKE CONCAT('meta.group.', ?, '.title.%')
        `,
        [player.uuid, rankSlug]
      );

      if (title) {
        await queryDb(
          `
            INSERT INTO ${LUCKPERMS_USER_PERMISSIONS_TABLE}
              (uuid, permission, value, server, world, expiry, contexts)
            VALUES (?, ?, 1, 'global', 'global', 0, '[]')
          `,
          [
            player.uuid,
            `meta.group.${rankSlug}.title.${title.substring(0, 64)}`,
          ]
        );
      }

      return res.send({
        success: true,
        message: "Rank assigned successfully.",
        actor: actor || null,
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  app.post(`${baseEndpoint}/user/remove`, async function (req, res) {
    isFeatureEnabled(features.ranks, res, lang);

    const { username, rankSlug } = req.body || {};

    if (!username || !rankSlug) {
      return res.send({
        success: false,
        message: "Username and rankSlug are required.",
      });
    }

    try {
      const player = await resolvePlayer(username);

      if (!player || !player.uuid) {
        return res.send({ success: false, message: "Player not found." });
      }

      const result = await queryDb(
        `
          DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ? AND permission = ?
        `,
        [player.uuid, `group.${rankSlug}`]
      );

      await queryDb(
        `
          DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ?
            AND permission LIKE CONCAT('meta.group.', ?, '.title.%')
        `,
        [player.uuid, rankSlug]
      );

      return res.send({
        success: true,
        message:
          result?.affectedRows > 0
            ? "Rank removed successfully."
            : "Rank was not assigned to the player.",
      });
    } catch (error) {
      return res.send({ success: false, message: `${error}` });
    }
  });

  app.post(
    `${baseEndpoint}/user/permission/check`,
    async function (req, res) {
      isFeatureEnabled(features.ranks, res, lang);

      const { username, permission } = req.body || {};

      if (!username || !permission) {
        return res.send({
          success: false,
          message: "Username and permission are required.",
        });
      }

      try {
        const player = await resolvePlayer(username);

        if (!player || !player.userId) {
          return res.send({
            success: false,
            message: "Player must have an active web account to check permissions.",
          });
        }

        const userData = await new UserGetter().byUserId(player.userId);

        if (!userData) {
          return res.send({
            success: false,
            message: "Unable to load player profile.",
          });
        }

        const permissions = await getUserPermissions(userData);
        const hasPermission = permissionMatch(permissions, permission);

        return res.send({
          success: true,
          data: {
            hasPermission,
            permission,
            username: player.username,
            ranks: permissions.userRanks || [],
          },
        });
      } catch (error) {
        return res.send({ success: false, message: `${error}` });
      }
    }
  );
}
