import * as cheerio from "cheerio";
import fetchDefault from "node-fetch";
import { createNameMcCache } from "./nameMcCache.mjs";

const USER_AGENT = "ZanderBot/1.0 (+namehistory-lookup; contact: staff)";

// Returns one of three distinct signals so callers can tell "no history"
// apart from "we couldn't parse the page":
//   - null:      page doesn't look like a NameMC profile at all (no
//                current-name heading) -> mapped to "not_found".
//   - undefined: page IS a profile, but the name-history container itself
//                is missing (markup likely changed) -> mapped to
//                "unavailable", NEVER conflated with "no history".
//   - []:        page IS a profile, the container is present, and it
//                genuinely contains zero name-change rows.
export function parsePreviousNames(html) {
  const $ = cheerio.load(html);

  const currentName = $("h1.mb-0").first().text().trim();
  if (!currentName) return null;

  // The "Name History" card is expected on every valid profile page,
  // independent of whether the player has any recorded name changes: a
  // ".card-header" whose text is "Name History" followed by its
  // ".card-body". If this container can't be found, NameMC's markup has
  // likely changed and we can no longer trust an empty row set to mean
  // "no history".
  const historyHeader = $(".card-header").filter((_, el) => $(el).text().trim() === "Name History").first();
  const historyContainer = historyHeader.length > 0 ? historyHeader.next(".card-body") : $();

  // If the specific container selector doesn't match (markup shifted
  // slightly — icon in the header, body nested deeper, etc.), fall back to
  // searching the row selector globally across the whole document. Only
  // when NEITHER the container NOR any global rows are found do we treat
  // this as "unavailable" — otherwise a minor markup drift would silently
  // take down the whole feature instead of just degrading gracefully.
  const rows =
    historyContainer.length > 0
      ? historyContainer.find(".name-change-row")
      : $(".name-change-row");

  if (historyContainer.length === 0 && rows.length === 0) {
    return undefined;
  }

  const previousNames = [];
  rows.each((_, el) => {
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
      if (previousNames === undefined) {
        // Profile page loaded, but the name-history container couldn't be
        // located — treat this as a parse failure, not "no history".
        return { status: "unavailable" };
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
