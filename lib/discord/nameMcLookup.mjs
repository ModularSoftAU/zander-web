import * as cheerio from "cheerio";
import fetchDefault from "node-fetch";
import { createNameMcCache } from "./nameMcCache.mjs";

const USER_AGENT = "ZanderBot/1.0 (+namehistory-lookup; contact: staff)";

export function parsePreviousNames(html) {
  const $ = cheerio.load(html);

  const currentName = $("h1.mb-0").first().text().trim();
  if (!currentName) return null;

  const previousNames = [];
  $(".name-change-row").each((_, el) => {
    const name = $(el).attr("data-name");
    const changedAtRaw = $(el).attr("data-changed-at");
    if (name) {
      previousNames.push({
        name,
        changedAt: changedAtRaw ? new Date(changedAtRaw) : null,
      });
    }
  });

  return previousNames;
}

export function createNameMcPreviousNamesService({ requestTimeoutMs, cacheTtlMs, minIntervalMs, fetchImpl = fetchDefault }) {
  const cache = createNameMcCache({ cacheTtlMs, minIntervalMs });

  async function fetchProfile(uuid) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(`https://namemc.com/profile/${encodeURIComponent(uuid)}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });

      if (response.status === 404) {
        return { status: "not_found" };
      }
      if (!response.ok) {
        // Includes 429 — treated as unavailable; caller relies on the throttle to
        // avoid hammering NameMC after this happens.
        return { status: "unavailable" };
      }

      const html = await response.text();
      const previousNames = parsePreviousNames(html);
      if (previousNames === null) {
        return { status: "not_found" };
      }

      return { status: "found", previousNames };
    } catch {
      return { status: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchPreviousNames(uuid) {
    const cached = cache.getCached(uuid);
    if (cached) return cached;

    const result = await cache.dedupe(uuid, () => cache.throttle(() => fetchProfile(uuid)));

    if (result.status === "found") {
      cache.setCached(uuid, result);
    }

    return result;
  }

  return { fetchPreviousNames };
}
