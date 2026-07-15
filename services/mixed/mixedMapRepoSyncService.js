/**
 * services/mixed/mixedMapRepoSyncService.js
 *
 * MixedMapRepoSyncService — syncs Mixed PGM maps from configured GitHub
 * repos by scanning `<mapsPath>/<mapKey>/map.xml` in each repo and parsing
 * it directly (no manifest / maps.json). A bad map or an unreachable source
 * never aborts the rest of the run.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../../config.json");

import * as mixed from "../../controllers/mixedController.js";
import { getMapSyncConfig, getEnabledSourcesSorted, MIXED_MAP_ADMIN_DEFAULTS } from "../../lib/mixed/mapSyncConfig.js";
import { createGithubClient, GithubFetchError } from "../../lib/mixed/githubClient.js";
import { parseMapXml } from "../../lib/mixed/pgmMapXmlParser.js";

const ASSET_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const THUMBNAIL_BASENAMES = ["thumbnail", "map", "overview", "image", "preview"];

export class SourceNotFoundError extends Error {
  constructor(sourceKey) {
    super(`Map source "${sourceKey}" is not configured or is disabled.`);
    this.name = "SourceNotFoundError";
  }
}

// Matches the map_key format the zander-pgm plugin already reports over
// heartbeat/ingestion (lowercase, underscore-separated) so a map discovered
// from live play and the same map discovered via repo sync resolve to one row.
function slugifyMapKey(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "map";
}

/**
 * Finds every map.xml under mapsPath, at any depth — real map repos vary
 * between maps living at the repo root and maps nested under category
 * folders (e.g. "CTW/Twisted Vines/map.xml"). The map's own directory name
 * (immediately containing map.xml) becomes the map key, slugified.
 */
function listMapDirs(tree, mapsPath) {
  const basePrefix = mapsPath && mapsPath !== "." ? `${mapsPath.replace(/^\.?\/*/, "").replace(/\/$/, "")}/` : "";
  const dirs = [];
  for (const entry of tree) {
    if (entry.type !== "blob") continue;
    if (basePrefix && !entry.path.startsWith(basePrefix)) continue;
    if (!entry.path.endsWith("/map.xml")) continue;
    const dirPath = entry.path.slice(0, -"/map.xml".length);
    const rawName = dirPath.split("/").pop();
    dirs.push({ mapKey: slugifyMapKey(rawName), rawName, xmlPath: entry.path, dirPrefix: `${dirPath}/` });
  }
  return dirs;
}

/** Discovers thumbnail/screenshots for a map dir using the already-fetched tree (no extra API calls). */
function discoverAssets(tree, dirPrefix, githubClient, repo, branch) {
  const filesInDir = new Set(tree.filter((e) => e.type === "blob" && e.path.startsWith(dirPrefix)).map((e) => e.path));

  let thumbnail = null;
  for (const baseName of THUMBNAIL_BASENAMES) {
    for (const ext of ASSET_EXTENSIONS) {
      const p = `${dirPrefix}${baseName}.${ext}`;
      if (filesInDir.has(p)) {
        thumbnail = githubClient.buildRawUrl(repo, branch, p);
        break;
      }
    }
    if (thumbnail) break;
  }

  const screenshotPrefix = `${dirPrefix}screenshots/`;
  const rootImages = [...filesInDir]
    .filter((p) => {
      if (p.startsWith(screenshotPrefix)) return false;
      if (p === `${dirPrefix}map.xml`) return false;
      const relative = p.slice(dirPrefix.length);
      if (relative.includes("/")) return false;
      return ASSET_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(`.${ext}`));
    })
    .sort();

  const screenshotImages = [...filesInDir]
    .filter((p) => p.startsWith(screenshotPrefix) && ASSET_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(`.${ext}`)))
    .sort();

  const screenshots = [...new Set([
    ...rootImages,
    ...screenshotImages,
  ])]
    .map((p) => githubClient.buildRawUrl(repo, branch, p));

  if (!thumbnail && screenshots.length) thumbnail = screenshots[0];

  return { thumbnail, screenshots };
}

function buildMapRow(source, mapKey, xmlPath, parsedData, assets, commitSha, rawName) {
  return {
    map_key: mapKey,
    name: parsedData.name || rawName || mapKey,
    version: parsedData.version,
    gamemode: parsedData.gamemode || MIXED_MAP_ADMIN_DEFAULTS.gamemode,
    gamemodes: parsedData.gamemodes?.length ? parsedData.gamemodes : MIXED_MAP_ADMIN_DEFAULTS.gamemodes,
    authors: parsedData.authors || [],
    contributors: parsedData.contributors || [],
    description_from_xml: parsedData.description,
    teams_from_xml: parsedData.teams || [],
    objectives_from_xml: parsedData.objectives || [],
    rules_from_xml: parsedData.rules || [],
    thumbnail_from_repo: assets.thumbnail,
    screenshots_from_repo: assets.screenshots,
    inferred_tags: parsedData.gamemodes || [],
    source_key: source.sourceKey,
    source_display_name: source.displayName,
    source_org: source.org,
    source_repo: source.repo,
    source_branch: source.branch,
    source_path: xmlPath,
    source_commit: commitSha,
    last_sync_status: "ok",
    last_sync_error: null,
    public_visible: MIXED_MAP_ADMIN_DEFAULTS.public_visible,
    voting_enabled: MIXED_MAP_ADMIN_DEFAULTS.voting_enabled,
    token_enabled: MIXED_MAP_ADMIN_DEFAULTS.token_enabled,
    blacklisted_from_voting: MIXED_MAP_ADMIN_DEFAULTS.blacklisted_from_voting,
    blacklisted_from_tokens: MIXED_MAP_ADMIN_DEFAULTS.blacklisted_from_tokens,
  };
}

/** Cross-source duplicate resolution. Mutates nothing; returns a decision. */
function resolveDuplicate(seenMapKeys, mapKey, source, strategy) {
  const existing = seenMapKeys.get(mapKey);
  if (!existing) return { action: "take", finalMapKey: mapKey };

  switch (strategy) {
    case "prefer_first":
      return { action: "skip", reason: `Duplicate of map already synced from source "${existing.sourceKey}".` };
    case "prefer_latest": {
      const existingTime = existing.committedAt ? new Date(existing.committedAt).getTime() : 0;
      const currentTime = source.committedAt ? new Date(source.committedAt).getTime() : 0;
      if (currentTime > existingTime) return { action: "take", finalMapKey: mapKey, evicts: existing.sourceKey };
      return { action: "skip", reason: `Older commit than source "${existing.sourceKey}" for the same map key.` };
    }
    case "prefix_source_key":
      return { action: "take", finalMapKey: `${source.sourceKey}-${mapKey}` };
    case "conflict":
    default:
      return {
        action: "conflict",
        reason: `Map key "${mapKey}" already synced from source "${existing.sourceKey}"; keeping that copy (duplicateMapKeyStrategy=conflict).`,
      };
  }
}

async function runOneSource(source, ctx) {
  const { seenMapKeys, triggeredBy } = ctx;
  const runId = await mixed.createSyncRun({
    sourceKey: source.sourceKey, sourceDisplayName: source.displayName,
    sourceOrg: source.org, sourceRepo: source.repo, sourceBranch: source.branch,
    triggeredBy,
  });

  const counts = { found: 0, created: 0, updated: 0, skipped: 0, conflicts: 0 };
  let commitSha = null;

  try {
    const githubClient = source.client;
    const commit = await githubClient.getLatestCommitSha(source.repo, source.branch);
    commitSha = commit?.sha || null;

    const tree = await githubClient.getTree(source.repo, source.branch);
    if (tree == null) {
      await mixed.recordSyncError({
        runId, sourceKey: source.sourceKey, sourceOrg: source.org, sourceRepo: source.repo,
        errorType: "GITHUB_FETCH_FAILED", message: `Repo or branch not found: ${source.repo}@${source.branch}`,
      });
      await mixed.finishSyncRun(runId, { status: "failed", errorMessage: "Repo or branch not found.", ...toFinishCounts(counts) });
      return { sourceKey: source.sourceKey, runId, status: "failed", counts };
    }

    const mapDirs = listMapDirs(tree, source.mapsPath);
    counts.found = mapDirs.length;

    for (const dir of mapDirs) {
      try {
        const existingMap = await mixed.getMap(dir.mapKey, { includeSourceInfo: true }).catch(() => null);
        const decision = resolveDuplicate(seenMapKeys, dir.mapKey, source, ctx.strategy);

        if (decision.action === "skip") {
          counts.skipped += 1;
          await mixed.recordSyncError({
            runId, sourceKey: source.sourceKey, sourceOrg: source.org, sourceRepo: source.repo,
            mapKey: dir.mapKey, sourcePath: dir.xmlPath,
            errorType: "DUPLICATE_MAP_KEY", message: decision.reason,
          });
          continue;
        }
        if (decision.action === "conflict") {
          counts.skipped += 1;
          counts.conflicts += 1;
          await mixed.recordSyncError({
            runId, sourceKey: source.sourceKey, sourceOrg: source.org, sourceRepo: source.repo,
            mapKey: dir.mapKey, sourcePath: dir.xmlPath,
            errorType: "DUPLICATE_MAP_KEY", message: decision.reason,
          });
          await mixed.markMapSyncConflict(dir.mapKey, decision.reason);
          continue;
        }

        const xml = await githubClient.getFileRaw(source.repo, source.branch, dir.xmlPath);
        if (xml == null) {
          counts.skipped += 1;
          await mixed.recordSyncError({
            runId, sourceKey: source.sourceKey, sourceOrg: source.org, sourceRepo: source.repo,
            mapKey: dir.mapKey, sourcePath: dir.xmlPath,
            errorType: "MISSING_MAP_XML", message: "map.xml could not be fetched (404).",
          });
          continue;
        }

        const parsed = parseMapXml(xml);
        if (!parsed.ok) {
          counts.skipped += 1;
          await mixed.recordSyncError({
            runId, sourceKey: source.sourceKey, sourceOrg: source.org, sourceRepo: source.repo,
            mapKey: dir.mapKey, sourcePath: dir.xmlPath,
            errorType: "INVALID_XML", message: parsed.error,
          });
          continue;
        }

        const assets = discoverAssets(tree, dir.dirPrefix, githubClient, source.repo, source.branch);
        const row = buildMapRow(source, decision.finalMapKey, dir.xmlPath, parsed.data, assets, commitSha, dir.rawName);
        await mixed.upsertMapFromRepoSync(row);

        seenMapKeys.set(dir.mapKey, { sourceKey: source.sourceKey, committedAt: source.committedAt });
        if (existingMap && !existingMap.discovered_from_server) counts.updated += 1;
        else counts.created += 1;
      } catch (err) {
        counts.skipped += 1;
        await mixed.recordSyncError({
          runId, sourceKey: source.sourceKey, sourceOrg: source.org, sourceRepo: source.repo,
          mapKey: dir.mapKey, sourcePath: dir.xmlPath,
          errorType: err instanceof GithubFetchError ? "GITHUB_FETCH_FAILED" : "UNKNOWN_ERROR",
          message: err?.message || String(err),
        });
      }
    }

    const status = counts.conflicts > 0 || counts.skipped > 0
      ? (counts.created + counts.updated > 0 ? "partial_success" : "failed")
      : "success";
    await mixed.finishSyncRun(runId, { status, sourceCommit: commitSha, ...toFinishCounts(counts) });
    return { sourceKey: source.sourceKey, runId, status, counts, sourceCommit: commitSha };
  } catch (err) {
    await mixed.recordSyncError({
      runId, sourceKey: source.sourceKey, sourceOrg: source.org, sourceRepo: source.repo,
      errorType: err instanceof GithubFetchError ? "GITHUB_FETCH_FAILED" : "UNKNOWN_ERROR",
      message: err?.message || String(err),
    });
    await mixed.finishSyncRun(runId, { status: "failed", errorMessage: err?.message || String(err), ...toFinishCounts(counts) });
    return { sourceKey: source.sourceKey, runId, status: "failed", counts, error: err?.message || String(err) };
  }
}

function toFinishCounts(counts) {
  return {
    mapsFound: counts.found, mapsCreated: counts.created, mapsUpdated: counts.updated,
    mapsSkipped: counts.skipped, conflictsFound: counts.conflicts,
  };
}

/** Resolves the enabled+configured sources into ready-to-use source contexts (client, org, commit metadata for prefer_latest). */
async function prepareSources(mapSyncCfg, { onlySourceKey } = {}) {
  const enabled = getEnabledSourcesSorted(config);
  const targets = onlySourceKey ? enabled.filter((s) => s.sourceKey === onlySourceKey) : enabled;
  if (onlySourceKey && !targets.length) throw new SourceNotFoundError(onlySourceKey);

  const client = createGithubClient({ org: mapSyncCfg.githubOrg, token: mapSyncCfg.githubToken });
  const prepared = [];
  for (const s of targets) {
    let committedAt = null;
    if (mapSyncCfg.duplicateMapKeyStrategy === "prefer_latest") {
      const commit = await client.getLatestCommitSha(s.repo, s.branch).catch(() => null);
      committedAt = commit?.committedAt || null;
    }
    prepared.push({ ...s, org: mapSyncCfg.githubOrg, client, committedAt });
  }
  if (mapSyncCfg.duplicateMapKeyStrategy === "prefer_latest") {
    prepared.sort((a, b) => new Date(b.committedAt || 0) - new Date(a.committedAt || 0));
  }
  return prepared;
}

/** Pre-seeds seenMapKeys from already-synced maps in the DB (for single-source resyncs / cross-run conflict detection). */
async function seedSeenMapKeys(excludeSourceKey) {
  const rows = await mixed.q(
    `SELECT map_key, source_key FROM mixed_maps WHERE source_key IS NOT NULL AND source_key != ? AND discovered_from_server = 0`,
    [excludeSourceKey || "__none__"]
  );
  const map = new Map();
  for (const r of rows) map.set(r.map_key, { sourceKey: r.source_key, committedAt: null });
  return map;
}

export async function syncAll({ triggeredBy } = {}) {
  const mapSyncCfg = getMapSyncConfig(config);
  if (!mapSyncCfg.enabled) throw new Error("mixed.mapSync.enabled is false in config.json.");

  const sources = await prepareSources(mapSyncCfg);
  const seenMapKeys = new Map();
  const results = [];

  for (const source of sources) {
    const result = await runOneSource(source, { seenMapKeys, triggeredBy, strategy: mapSyncCfg.duplicateMapKeyStrategy });
    results.push(result);
  }

  const summary = results.reduce((acc, r) => ({
    mapsFound: acc.mapsFound + (r.counts?.found || 0),
    mapsCreated: acc.mapsCreated + (r.counts?.created || 0),
    mapsUpdated: acc.mapsUpdated + (r.counts?.updated || 0),
    mapsSkipped: acc.mapsSkipped + (r.counts?.skipped || 0),
    conflictsFound: acc.conflictsFound + (r.counts?.conflicts || 0),
  }), { mapsFound: 0, mapsCreated: 0, mapsUpdated: 0, mapsSkipped: 0, conflictsFound: 0 });

  const overallStatus = results.every((r) => r.status === "success")
    ? "success"
    : results.some((r) => r.status === "success" || r.status === "partial_success")
      ? "partial_success"
      : "failed";

  return { status: overallStatus, sources: results, summary };
}

export async function syncSource(sourceKey, { triggeredBy } = {}) {
  const mapSyncCfg = getMapSyncConfig(config);
  if (!mapSyncCfg.enabled) throw new Error("mixed.mapSync.enabled is false in config.json.");

  const sources = await prepareSources(mapSyncCfg, { onlySourceKey: sourceKey });
  const source = sources[0];
  const seenMapKeys = await seedSeenMapKeys(sourceKey);

  return runOneSource(source, { seenMapKeys, triggeredBy, strategy: mapSyncCfg.duplicateMapKeyStrategy });
}
