/**
 * lib/mixed/mapSyncConfig.js
 *
 * Loads and normalises the `mixed.mapSync` block from config.json. The
 * GitHub token itself is resolved from the env var named by
 * `githubTokenEnv` and is never included in any object returned toward
 * views/JSON responses (see getPublicSourcesInfo).
 */

export const MIXED_MAP_ADMIN_DEFAULTS = {
  public_visible: 1,
  voting_enabled: 1,
  token_enabled: 1,
  blacklisted_from_voting: 0,
  blacklisted_from_tokens: 0,
  gamemode: "Unknown",
  gamemodes: [],
};

const DUPLICATE_STRATEGIES = ["conflict", "prefer_first", "prefer_latest", "prefix_source_key"];

function normaliseSource(raw, index) {
  if (!raw || !raw.repo || !raw.sourceKey) return null;
  return {
    sourceKey: String(raw.sourceKey),
    displayName: raw.displayName || raw.sourceKey,
    repo: String(raw.repo),
    branch: raw.branch || "main",
    mapsPath: raw.mapsPath || "maps",
    enabled: raw.enabled !== false,
    priority: Number.isFinite(raw.priority) ? raw.priority : 100 + index,
  };
}

/**
 * @param {object} config the full loaded config.json object
 * @returns {{
 *   enabled: boolean, provider: string, githubOrg: string, githubToken: string|null,
 *   duplicateMapKeyStrategy: string, assetUrlMode: string, cronSchedule: string,
 *   sources: Array<object>
 * }}
 */
export function getMapSyncConfig(config) {
  const raw = config?.mixed?.mapSync || {};
  const githubTokenEnv = raw.githubTokenEnv || null;
  const githubToken = githubTokenEnv ? (process.env[githubTokenEnv] || null) : null;
  const duplicateMapKeyStrategy = DUPLICATE_STRATEGIES.includes(raw.duplicateMapKeyStrategy)
    ? raw.duplicateMapKeyStrategy
    : "conflict";
  const sources = Array.isArray(raw.sources)
    ? raw.sources.map(normaliseSource).filter(Boolean)
    : [];

  return {
    enabled: raw.enabled === true,
    provider: raw.provider || "github",
    githubOrg: raw.githubOrg || null,
    githubToken,
    duplicateMapKeyStrategy,
    assetUrlMode: raw.assetUrlMode || "raw",
    cronSchedule: raw.cronSchedule || "0 * * * *",
    sources,
  };
}

/** Sanitized source list for admin API/UI consumption — never includes the token. */
export function getPublicSourcesInfo(config) {
  const cfg = getMapSyncConfig(config);
  return {
    enabled: cfg.enabled,
    githubOrg: cfg.githubOrg,
    duplicateMapKeyStrategy: cfg.duplicateMapKeyStrategy,
    assetUrlMode: cfg.assetUrlMode,
    sources: cfg.sources.map((s) => ({
      sourceKey: s.sourceKey,
      displayName: s.displayName,
      repo: s.repo,
      branch: s.branch,
      mapsPath: s.mapsPath,
      enabled: s.enabled,
      priority: s.priority,
    })),
  };
}

export function getEnabledSourcesSorted(config) {
  return getMapSyncConfig(config).sources
    .filter((s) => s.enabled)
    .sort((a, b) => a.priority - b.priority);
}
