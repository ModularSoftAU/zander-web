/**
 * services/mixed/_shared.js
 *
 * Shared internals for the Mixed data-access modules: the pooled mysql2 query
 * helpers (`q`, `one`, plus the raw `conn` for transactions), UUID / feedback
 * validation, JSON (de)serialisation, and the map-row display-field builders.
 *
 * `q`, `isValidUuid`, `normaliseUuid` and `sanitiseFeedback` are part of the
 * public Mixed API and are re-exported by controllers/mixedController.js; the
 * rest are internal to services/mixed/.
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 */

import pool from "../../controllers/databaseController.js";

// Promise-based query helper over the shared mysql2 pool.
export const conn = pool.promise();
export async function q(sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}
export async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/;

export function isValidUuid(value) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function normaliseUuid(value) {
  if (!isValidUuid(value)) return null;
  const hex = value.trim().replace(/-/g, "").toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Basic HTML-stripping + trim used before storing/showing player feedback. */
export function sanitiseFeedback(text) {
  if (text == null) return null;
  return String(text)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

export function toJson(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}
export function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function firstNonEmptyString(values = []) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function normalisePeopleList(...lists) {
  return [...new Set(
    lists
      .flat()
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
  )];
}

/** Applies the custom-override-over-repo-data fallback chain used by public map views. */
export function withDisplayFields(row) {
  const inferredTags = parseJson(row.inferred_tags, []);
  const customTags = parseJson(row.custom_tags, []);
  const authors = normalisePeopleList(parseJson(row.authors, []));
  const contributors = normalisePeopleList(parseJson(row.contributors, []));
  const screenshots = parseJson(row.screenshots_from_repo, []);
  const fallbackImage = firstNonEmptyString(screenshots);
  const displayThumbnailUrl = row.custom_thumbnail_url || row.thumbnail_from_repo || row.thumbnail_url || fallbackImage || null;
  // Placeholder rows (discovered from live play, not yet matched to a repo
  // sync) store the raw map_key as name until a sync fills in the real one —
  // prettify that case instead of showing the slug verbatim.
  const displayName = row.name && row.name !== row.map_key
    ? row.name
    : String(row.map_key || row.name || "")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || row.name;
  return {
    ...row,
    authors,
    contributors,
    screenshots_from_repo: screenshots,
    display_name: displayName,
    display_authors: authors.length ? authors : contributors,
    display_description: row.custom_description || row.description_from_xml || row.description || "No description available.",
    display_thumbnail_url: displayThumbnailUrl,
    display_image_url: displayThumbnailUrl,
    display_tags: [...new Set([...(inferredTags || []), ...(customTags || [])])],
  };
}

/** Strips repo-source fields from a map row for non-admin public responses. */
export function stripSourceInfo(row) {
  const {
    source_key, source_display_name, source_org, source_repo,
    source_branch, source_path, source_commit, ...rest
  } = row;
  return rest;
}
