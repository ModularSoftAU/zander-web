import { isFeatureEnabled, optional } from "../common.js";
import {
  UserGetter,
  getUserPermissions,
} from "../../controllers/userController.js";

const RANK_VIEW = "ranks";
const USER_RANKS_VIEW = "userRanks";
const LUCKPERMS_PLAYERS_VIEW = "luckPermsPlayers";
const LUCKPERMS_GROUP_PERMISSIONS_TABLE =
  "cfcdev_luckperms.luckperms_group_permissions";
const LUCKPERMS_USER_PERMISSIONS_TABLE =
  "cfcdev_luckperms.luckperms_user_permissions";

function parseBoolean(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return false;
}

function normalizeColour(value) {
  if (!value) return null;
  let trimmed = String(value).trim().replace(/[^0-9a-fA-F#]/g, "");
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

  return `#${trimmed.substring(0, 6).toLowerCase()}`;
}

function mapRankRow(row) {
  const priority =
    row.priority !== null && row.priority !== undefined && row.priority !== ""
      ? Number(row.priority)
      : null;

  const isStaff =
    row.isStaff !== null && row.isStaff !== undefined && row.isStaff !== ""
      ? Number(row.isStaff)
      : 0;
  const isDonator =
    row.isDonator !== null && row.isDonator !== undefined && row.isDonator !== ""
      ? Number(row.isDonator)
      : 0;

  return {
    rankSlug: row.rankSlug,
    displayName: row.displayName || row.rankSlug,
    priority,
    rankBadgeColour: row.rankBadgeColour || null,
    rankTextColour: row.rankTextColour || null,
    discordRoleId: row.discordRoleId || null,
    isStaff,
    isDonator,
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

  async function resolvePlayer(username) {
    if (!username) {
      return null;
    }

    const trimmedUsername = String(username).trim();
    if (!trimmedUsername) {
      return null;
    }

    const [webUser] = await queryDb(
      `SELECT userId, username, uuid FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
      [trimmedUsername]
    );

    const [luckPermsUser] = await queryDb(
      `SELECT username, uuid FROM ${LUCKPERMS_PLAYERS_VIEW} WHERE LOWER(username) = LOWER(?) LIMIT 1`,
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

  async function updateGroupNode(rankSlug, key, rawValue) {
    const trimmedValue =
      rawValue === null || rawValue === undefined
        ? null
        : String(rawValue).trim();

    const effectiveValue = trimmedValue === "" ? null : trimmedValue;

    await queryDb(
      `DELETE FROM ${LUCKPERMS_GROUP_PERMISSIONS_TABLE}
        WHERE name = ?
          AND permission LIKE ?
          AND server = 'global'
          AND world = 'global'`,
      [rankSlug, `${key}.%`]
    );

    if (effectiveValue === null) {
      return;
    }

    await queryDb(
      `INSERT INTO ${LUCKPERMS_GROUP_PERMISSIONS_TABLE}
        (name, permission, value, server, world, expiry, contexts)
      VALUES (?, ?, 1, 'global', 'global', 0, '{}')`,
      [rankSlug, `${key}.${effectiveValue}`],
    );
  }

  async function getRankDirectory() {
    const results = await queryDb(
      `SELECT
        rankSlug,
        displayName,
        priority,
        rankBadgeColour,
        rankTextColour,
        discordRoleId,
        isStaff,
        isDonator
      FROM ${RANK_VIEW}
      ORDER BY CAST(COALESCE(priority, 0) AS UNSIGNED) DESC, rankSlug`
    );

    return results.map((row) => mapRankRow(row));
  }

  app.get(`${baseEndpoint}/get`, async function (req, res) {
    if (!isFeatureEnabled(features.ranks, res, lang)) return;
    const username = optional(req.query, "username");
    const rankSlug = optional(req.query, "rank");

    try {
      if (username) {
        const player = await resolvePlayer(username);

        if (!player || !player.uuid) {
          return res.send({
            success: false,
            message: "Player not found.",
          });
        }

        const rows = await queryDb(
          `SELECT
              r.rankSlug,
              r.displayName,
              r.priority,
              r.rankBadgeColour,
              r.rankTextColour,
              r.discordRoleId,
              r.isStaff,
              r.isDonator,
              ur.title
            FROM ${USER_RANKS_VIEW} ur
              JOIN ${RANK_VIEW} r ON ur.rankSlug = r.rankSlug
            WHERE ur.uuid = ?
            ORDER BY CAST(COALESCE(r.priority, 0) AS UNSIGNED) DESC, r.rankSlug`,
          [player.uuid]
        );

        const mapped = rows.map((row) => ({
          ...mapRankRow(row),
          title: row.title || null,
        }));

        return res.send({
          success: true,
          data: mapped,
          user: player,
        });
      }

      if (rankSlug) {
        const rows = await queryDb(
          `SELECT
              u.userId,
              lp.uuid,
              COALESCE(u.username, lp.username) AS username,
              r.displayName,
              r.rankBadgeColour,
              r.rankTextColour,
              ur.title
            FROM ${RANK_VIEW} r
              JOIN ${USER_RANKS_VIEW} ur ON ur.rankSlug = r.rankSlug
              JOIN ${LUCKPERMS_PLAYERS_VIEW} lp ON ur.uuid = lp.uuid
              LEFT JOIN users u ON lp.uuid = u.uuid
            WHERE r.rankSlug = ?
            ORDER BY COALESCE(u.username, lp.username)`,
          [rankSlug]
        );

        return res.send({ success: true, data: rows });
      }

      const directory = await getRankDirectory();
      return res.send({ success: true, data: directory });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({ success: false, message: `${error}` });
      }
    }
  });

  app.get(`${baseEndpoint}/user`, async function (req, res) {
    if (!isFeatureEnabled(features.ranks, res, lang)) return;
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
        `SELECT
            r.rankSlug,
            r.displayName,
            r.priority,
            r.rankBadgeColour,
            r.rankTextColour,
            r.discordRoleId,
            r.isStaff,
            r.isDonator,
            ur.title
          FROM ${USER_RANKS_VIEW} ur
            JOIN ${RANK_VIEW} r ON ur.rankSlug = r.rankSlug
          WHERE ur.uuid = ?
          ORDER BY CAST(COALESCE(r.priority, 0) AS UNSIGNED) DESC, r.rankSlug`,
        [player.uuid]
      );

      const mappedRanks = ranks.map((row) => ({
        ...mapRankRow(row),
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
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({ success: false, message: `${error}` });
      }
    }
  });

  app.post(`${baseEndpoint}/config/:rankSlug`, async function (req, res) {
    if (!isFeatureEnabled(features.ranks, res, lang)) return;

    const rankSlug = req.params.rankSlug;
    const {
      displayName,
      rankBadgeColour,
      rankTextColour,
      priority,
      discordRoleId,
      isStaff,
      isDonator,
    } = req.body || {};

    if (!rankSlug) {
      return res.send({ success: false, message: "Rank slug is required." });
    }

    try {
      const sanitizedBadge = normalizeColour(rankBadgeColour);
      const sanitizedText = normalizeColour(rankTextColour);
      let sanitizedPriority = null;

      if (priority !== undefined && priority !== null && priority !== "") {
        const parsed = Number(priority);
        if (Number.isNaN(parsed)) {
          return res.send({
            success: false,
            message: "Priority must be a number.",
          });
        }
        sanitizedPriority = Math.floor(parsed);
      }

      const sanitizedDiscord =
        discordRoleId !== undefined && discordRoleId !== null
          ? String(discordRoleId).trim()
          : null;

      const staffFlag =
        isStaff === undefined || isStaff === null
          ? null
          : parseBoolean(isStaff)
          ? "1"
          : "0";
      const donatorFlag =
        isDonator === undefined || isDonator === null
          ? null
          : parseBoolean(isDonator)
          ? "1"
          : "0";

      await updateGroupNode(rankSlug, "displayname", displayName || null);
      await updateGroupNode(rankSlug, "weight", sanitizedPriority);
      await updateGroupNode(rankSlug, "meta.discordid", sanitizedDiscord);
      await updateGroupNode(rankSlug, "meta.staff", staffFlag);
      await updateGroupNode(rankSlug, "meta.donator", donatorFlag);
      await updateGroupNode(rankSlug, "meta.rankbadgecolour", sanitizedBadge);
      await updateGroupNode(rankSlug, "meta.ranktextcolour", sanitizedText);

      const [updatedRank] = await queryDb(
        `SELECT
            rankSlug,
            displayName,
            priority,
            rankBadgeColour,
            rankTextColour,
            discordRoleId,
            isStaff,
            isDonator
          FROM ${RANK_VIEW}
          WHERE rankSlug = ?
          LIMIT 1`,
        [rankSlug],
      );

      if (!updatedRank) {
        return res.send({
          success: false,
          message: "Unable to load the updated rank from LuckPerms.",
        });
      }

      return res.send({
        success: true,
        message: "Rank configuration updated.",
        data: mapRankRow(updatedRank),
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({ success: false, message: `${error}` });
      }
    }
  });

  app.post(`${baseEndpoint}/user/assign`, async function (req, res) {
    if (!isFeatureEnabled(features.ranks, res, lang)) return;

    const { username, rankSlug, title } = req.body || {};

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
        `SELECT uuid FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ? AND permission = ? AND value = 1 LIMIT 1`,
        [player.uuid, `group.${rankSlug}`]
      );

      if (existing) {
        return res.send({
          success: false,
          message: "Player already has this rank.",
        });
      }

      await queryDb(
        `INSERT INTO ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          (uuid, permission, value, server, world, expiry, contexts)
        VALUES (?, ?, 1, 'global', 'global', 0, '[]')`,
        [player.uuid, `group.${rankSlug}`]
      );

      await queryDb(
        `DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ?
            AND permission LIKE CONCAT('meta.group.', ?, '.title.%')`,
        [player.uuid, rankSlug]
      );

      if (title) {
        await queryDb(
          `INSERT INTO ${LUCKPERMS_USER_PERMISSIONS_TABLE}
            (uuid, permission, value, server, world, expiry, contexts)
          VALUES (?, ?, 1, 'global', 'global', 0, '[]')`,
          [player.uuid, `meta.group.${rankSlug}.title.${title.substring(0, 64)}`]
        );
      }

      return res.send({
        success: true,
        message: "Rank assigned successfully.",
      });
    } catch (error) {
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({ success: false, message: `${error}` });
      }
    }
  });

  app.post(`${baseEndpoint}/user/remove`, async function (req, res) {
    if (!isFeatureEnabled(features.ranks, res, lang)) return;

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
        `DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ? AND permission = ?`,
        [player.uuid, `group.${rankSlug}`]
      );

      await queryDb(
        `DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = ?
            AND permission LIKE CONCAT('meta.group.', ?, '.title.%')`,
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
      console.error(error);
      if (!res.sent) {
        return res.status(500).send({ success: false, message: `${error}` });
      }
    }
  });

  app.post(
    `${baseEndpoint}/user/permission/check`,
    async function (req, res) {
      if (!isFeatureEnabled(features.ranks, res, lang)) return;

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
        console.error(error);
        if (!res.sent) {
          return res.status(500).send({ success: false, message: `${error}` });
        }
      }
    }
  );
}
