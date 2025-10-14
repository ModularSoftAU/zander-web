import { createRequire } from "module";
import {
  normalizeCommand,
  toMetadataObject,
  mergeMetadata,
  applyMetadataPlaceholders,
  normalizeRankAction,
  normalizePlayerMetadataKey,
  buildRankCommand,
} from "./bridge.js";
import { isFeatureEnabled } from "../common.js";

const require = createRequire(import.meta.url);

const TASK_TABLE = "executorTasks";
const DEFAULT_PRIORITY = 0;
const SECRET_HEADER_CANDIDATES = [
  "x-tebex-secret",
  "x-webhook-secret",
  "x-authorization",
  "authorization",
];

function loadConfig() {
  try {
    const config = require("../../tebex.json");
    if (!config || typeof config !== "object") {
      return { packages: [] };
    }
    return config;
  } catch (error) {
    console.warn("[tebex] Unable to load tebex.json configuration", error);
    return { packages: [] };
  }
}

const tebexConfig = loadConfig();

function coerceString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function buildPackageIndex(config) {
  const packages = Array.isArray(config?.packages) ? config.packages : [];
  const idMap = new Map();
  const nameMap = new Map();

  const recordId = (id, entry) => {
    const normalized = coerceString(id);
    if (!normalized || idMap.has(normalized)) {
      return;
    }

    idMap.set(normalized, entry);
  };

  const recordName = (name, entry) => {
    const normalized = coerceString(name)?.toLowerCase();
    if (!normalized || nameMap.has(normalized)) {
      return;
    }

    nameMap.set(normalized, entry);
  };

  packages.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    recordId(entry.packageId ?? entry.id, entry);

    if (Array.isArray(entry.packageIds)) {
      entry.packageIds.forEach((id) => recordId(id, entry));
    }

    if (Array.isArray(entry.aliases)) {
      entry.aliases.forEach((alias) => {
        if (typeof alias === "number" || (typeof alias === "string" && /\d/.test(alias))) {
          recordId(alias, entry);
        }
        recordName(alias, entry);
      });
    }

    recordName(entry.displayName ?? entry.packageName ?? entry.slug, entry);
  });

  return { packages, idMap, nameMap };
}

const packageIndex = buildPackageIndex(tebexConfig);
const defaultTargetSlug = coerceString(tebexConfig?.defaultTargetSlug);

function findPackageConfig(packagePayload) {
  if (!packagePayload || typeof packagePayload !== "object") {
    return null;
  }

  const idCandidates = [
    packagePayload.packageId,
    packagePayload.id,
    packagePayload.package_id,
    packagePayload.product_id,
    packagePayload.option_id,
    packagePayload.packageID,
  ];

  for (const id of idCandidates) {
    const normalized = coerceString(id);
    if (normalized && packageIndex.idMap.has(normalized)) {
      return packageIndex.idMap.get(normalized);
    }
  }

  const nameCandidates = [
    packagePayload.name,
    packagePayload.packageName,
    packagePayload.package_name,
    packagePayload.product_name,
    packagePayload.displayName,
  ];

  for (const name of nameCandidates) {
    const normalized = coerceString(name)?.toLowerCase();
    if (normalized && packageIndex.nameMap.has(normalized)) {
      return packageIndex.nameMap.get(normalized);
    }
  }

  return null;
}

function collectPlayerSources(payload) {
  const sources = [];
  const pushCandidate = (candidate) => {
    if (!candidate) {
      return;
    }

    if (typeof candidate === "string") {
      sources.push({ username: candidate });
      return;
    }

    if (typeof candidate !== "object") {
      return;
    }

    sources.push(candidate);

    if (candidate.meta && typeof candidate.meta === "object") {
      sources.push(candidate.meta);
    }

    if (candidate.data && typeof candidate.data === "object") {
      sources.push(candidate.data);
    }

    if (candidate.account && typeof candidate.account === "object") {
      sources.push(candidate.account);
    }
  };

  pushCandidate(payload.player);
  pushCandidate(payload.customer);
  pushCandidate(payload.user);
  pushCandidate(payload.buyer);
  pushCandidate(payload.checkout);
  pushCandidate(payload.meta);
  pushCandidate(payload.player?.meta);
  pushCandidate(payload.customer?.meta);
  pushCandidate(payload.player?.data);
  pushCandidate(payload.customer?.data);

  const inlineUsername = coerceString(payload.username ?? payload.playerName ?? payload.ign);
  if (inlineUsername) {
    sources.push({ username: inlineUsername });
  }

  const inlineUuid = coerceString(payload.uuid ?? payload.playerUuid ?? payload.player_uuid);
  if (inlineUuid) {
    sources.push({ uuid: inlineUuid });
  }

  return sources;
}

function pickFromSources(sources, keys) {
  for (const source of sources) {
    for (const key of keys) {
      if (!source || typeof source !== "object") {
        continue;
      }

      const value = source[key];
      const normalized = coerceString(value);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function resolvePlayer(payload) {
  const sources = collectPlayerSources(payload);
  const username = pickFromSources(sources, [
    "username",
    "ign",
    "player",
    "name",
    "nickname",
    "playerName",
    "minecraftUsername",
    "inGameName",
  ]);

  const uuid = pickFromSources(sources, [
    "uuid",
    "playerUuid",
    "player_uuid",
    "playerUuidFormatted",
    "id",
    "playerId",
  ]);

  const accountId = pickFromSources(sources, [
    "accountId",
    "account_id",
    "userId",
    "user_id",
    "customerId",
    "customer_id",
  ]);

  const email = pickFromSources(sources, ["email", "mail"]);

  return {
    username,
    uuid,
    accountId,
    email,
  };
}

function buildPurchaseMetadata(payload, playerInfo) {
  const metadata = {};

  if (playerInfo.username) {
    metadata.player = playerInfo.username;
  }

  if (playerInfo.uuid) {
    metadata.playerUuid = playerInfo.uuid;
  }

  if (playerInfo.accountId) {
    metadata.playerAccountId = playerInfo.accountId;
  }

  if (playerInfo.email) {
    metadata.playerEmail = playerInfo.email;
  }

  const purchaseId = coerceString(
    payload.transactionId ??
      payload.id ??
      payload.payment_id ??
      payload.purchase_id ??
      payload.reference ??
      payload.transaction
  );

  if (purchaseId) {
    metadata.tebexPurchaseId = purchaseId;
  }

  const currency = coerceString(
    payload.currency ??
      payload.currencyIso ??
      payload.currencyCode ??
      payload.currency_iso ??
      payload.currency_code
  );

  if (currency) {
    metadata.tebexCurrency = currency;
  }

  return Object.keys(metadata).length ? metadata : null;
}

function buildPackageMetadata(packagePayload) {
  const metadata = {};

  const packageId = coerceString(
    packagePayload.id ??
      packagePayload.packageId ??
      packagePayload.package_id ??
      packagePayload.product_id
  );

  if (packageId) {
    metadata.tebexPackageId = packageId;
  }

  const packageName = coerceString(
    packagePayload.name ??
      packagePayload.packageName ??
      packagePayload.package_name ??
      packagePayload.displayName
  );

  if (packageName) {
    metadata.tebexPackageName = packageName;
  }

  const variantId = coerceString(packagePayload.variant_id ?? packagePayload.variantId);
  if (variantId) {
    metadata.tebexVariantId = variantId;
  }

  const expiry =
    packagePayload.expiry ??
    packagePayload.expires_at ??
    packagePayload.expiry_date ??
    packagePayload.expireDate;

  if (expiry) {
    metadata.tebexPackageExpiry = expiry;
  }

  const price = packagePayload.price ?? packagePayload.cost ?? packagePayload.amount;
  if (price !== null && price !== undefined) {
    metadata.tebexPackagePrice = price;
  }

  return Object.keys(metadata).length ? metadata : null;
}

function resolveTargetSlug(action, packageConfig) {
  const candidates = [
    action?.target,
    action?.slug,
    action?.targetSlug,
    packageConfig?.target,
    packageConfig?.targetSlug,
    packageConfig?.slug,
    defaultTargetSlug,
  ];

  for (const candidate of candidates) {
    const normalized = coerceString(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function resolvePriority(action, packageConfig) {
  const priorityCandidates = [action?.priority, packageConfig?.priority];
  for (const candidate of priorityCandidates) {
    if (candidate === null || candidate === undefined) {
      continue;
    }

    const value = Number(candidate);
    if (!Number.isNaN(value)) {
      return value;
    }
  }

  return DEFAULT_PRIORITY;
}

function resolveActionType(action) {
  const typeValue = coerceString(action?.type)?.toLowerCase();
  if (typeValue === "rank") {
    return "rank";
  }

  if (typeValue === "command") {
    return "command";
  }

  if (coerceString(action?.rankSlug)) {
    return "rank";
  }

  return "command";
}

function buildActionCommand(action, packageConfig) {
  const actionType = resolveActionType(action);

  if (actionType === "rank") {
    const rankSlug = coerceString(action?.rankSlug ?? packageConfig?.rankSlug);
    if (!rankSlug) {
      throw new Error(`Rank actions require a rankSlug in the Tebex package config`);
    }

    const rankAction = normalizeRankAction(action?.rankAction ?? packageConfig?.rankAction);
    const playerKey = normalizePlayerMetadataKey(
      action?.playerMetadataKey ?? packageConfig?.playerMetadataKey
    );

    return buildRankCommand(rankSlug, rankAction, playerKey);
  }

  const template = coerceString(action?.command ?? packageConfig?.command);
  if (!template) {
    throw new Error(`Command actions require a command string in the Tebex package config`);
  }

  return template;
}

function normalizeActions(packageConfig) {
  if (Array.isArray(packageConfig?.actions) && packageConfig.actions.length > 0) {
    return packageConfig.actions;
  }

  const fallback = {};
  if (packageConfig.rankSlug) {
    fallback.type = "rank";
  } else if (packageConfig.command) {
    fallback.type = "command";
  }

  if (!fallback.type) {
    return [];
  }

  return [fallback];
}

function getSecretFromHeaders(req) {
  for (const header of SECRET_HEADER_CANDIDATES) {
    const value = req.headers?.[header];
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length) {
        return coerceString(value[0]);
      }
      continue;
    }

    const normalized = coerceString(value);
    if (!normalized) {
      continue;
    }

    if (normalized.toLowerCase().startsWith("bearer ")) {
      return coerceString(normalized.slice(7));
    }

    return normalized;
  }

  return null;
}

export default function tebexApiRoute(app, config, db, features, lang) {
  const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  };

  app.post("/api/tebex/webhook", async function (req, res) {
    isFeatureEnabled(features.bridge, res, lang);

    if (!features?.bridge) {
      return;
    }

    if (!tebexConfig || !Array.isArray(packageIndex.packages)) {
      return res.send({
        success: false,
        message: `Tebex configuration is not available`,
      });
    }

    const expectedSecret = coerceString(
      process.env.TEBEX_WEBHOOK_SECRET ?? process.env.tebexWebhookSecret
    );
    if (expectedSecret) {
      const provided = getSecretFromHeaders(req);
      if (!provided || provided !== expectedSecret) {
        return res.status(401).send({
          success: false,
          message: `Invalid Tebex webhook secret`,
        });
      }
    }

    if (!req.body || typeof req.body !== "object") {
      return res.status(400).send({
        success: false,
        message: `Webhook payload must be a JSON object`,
      });
    }

    const packages = Array.isArray(req.body.packages)
      ? req.body.packages
      : req.body.package
      ? [req.body.package]
      : [];

    if (!packages.length) {
      return res.send({
        success: true,
        message: `No packages included in Tebex payload`,
        data: {
          queuedTasks: 0,
          unmatchedPackages: [],
        },
      });
    }

    const playerInfo = resolvePlayer(req.body);
    if (!playerInfo.username) {
      return res.status(400).send({
        success: false,
        message: `Unable to resolve purchaser username from Tebex payload`,
      });
    }

    const purchaseMetadata = buildPurchaseMetadata(req.body, playerInfo);
    const unmatchedPackages = [];
    const queuedTaskIds = [];

    try {
      for (const packagePayload of packages) {
        const packageConfig = findPackageConfig(packagePayload);
        if (!packageConfig) {
          unmatchedPackages.push({
            packageId:
              coerceString(packagePayload?.id ?? packagePayload?.packageId ?? packagePayload?.package_id) ||
              null,
            packageName:
              coerceString(
                packagePayload?.name ??
                  packagePayload?.packageName ??
                  packagePayload?.package_name ??
                  packagePayload?.displayName
              ) || null,
          });
          continue;
        }

        const packageMetadata = buildPackageMetadata(packagePayload);
        const actions = normalizeActions(packageConfig);

        if (!actions.length) {
          continue;
        }

        for (const action of actions) {
          const targetSlug = resolveTargetSlug(action, packageConfig);
          if (!targetSlug) {
            throw new Error(
              `Unable to determine a target slug for Tebex package '${
                packageConfig.displayName || packageConfig.packageName || packageConfig.packageId
              }'`
            );
          }

          const metadata = mergeMetadata(
            purchaseMetadata,
            packageMetadata,
            toMetadataObject(packageConfig.metadata),
            toMetadataObject(action.metadata)
          );

          const commandTemplate = buildActionCommand(action, packageConfig);

          const resolvedCommand = normalizeCommand(
            applyMetadataPlaceholders(
              commandTemplate,
              purchaseMetadata,
              packageMetadata,
              packageConfig.metadata,
              action.metadata
            )
          );

          if (!resolvedCommand) {
            throw new Error(`Resolved command text is empty for Tebex package action`);
          }

          const priority = resolvePriority(action, packageConfig);

          const result = await query(
            `INSERT INTO ${TASK_TABLE} (slug, command, status, routineSlug, metadata, priority) VALUES (?, ?, 'pending', NULL, ?, ?)`,
            [targetSlug, resolvedCommand, metadata ? JSON.stringify(metadata) : null, priority]
          );

          queuedTaskIds.push(result.insertId);
        }
      }
    } catch (error) {
      return res.status(500).send({
        success: false,
        message: `${error}`,
      });
    }

    return res.send({
      success: true,
      message: `Queued ${queuedTaskIds.length} bridge task${queuedTaskIds.length === 1 ? "" : "s"} from Tebex webhook`,
      data: {
        queuedTasks: queuedTaskIds.length,
        taskIds: queuedTaskIds,
        unmatchedPackages,
        player: playerInfo,
      },
    });
  });
}
