/**
 * services/mixed/overview.js
 *
 * Aggregate reads for the Mixed admin dashboard and public landing page.
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import { q, one, parseJson, withDisplayFields } from "./_shared.js";
import { listServers } from "./servers.js";
import { getLiveMatches } from "./matches.js";
import { getLeaderboard, latestAchievements } from "./players.js";
import { getCurrentVote } from "./economy.js";

export async function adminOverview() {
  const [servers, recentMatches, pendingRequests, failedRequests, recentTx] = await Promise.all([
    listServers(),
    q(`SELECT * FROM mixed_matches ORDER BY started_at DESC LIMIT 10`),
    one(`SELECT COUNT(*) AS c FROM mixed_map_requests WHERE status IN ('pending','queued')`),
    one(`SELECT COUNT(*) AS c FROM mixed_map_requests WHERE status = 'failed'`),
    q(`SELECT * FROM mixed_map_token_transactions ORDER BY created_at DESC LIMIT 10`),
  ]);
  return {
    servers,
    recentMatches: recentMatches.map((r) => ({ ...r, winners: parseJson(r.winners, []) })),
    pendingRequests: pendingRequests?.c || 0,
    failedRequests: failedRequests?.c || 0,
    recentTransactions: recentTx,
  };
}

export async function landingData() {
  const [servers, live, featuredMaps, recentMatches, topLevel, latestAch, currentVote] = await Promise.all([
    listServers(),
    getLiveMatches(),
    q(`SELECT m.*, rt.average_overall, rt.rating_count FROM mixed_maps m
         LEFT JOIN mixed_map_rating_totals rt ON rt.map_key = m.map_key
        WHERE m.public_visible = 1 ORDER BY m.times_played DESC LIMIT 6`),
    q(`SELECT * FROM mixed_matches WHERE status = 'ended' ORDER BY started_at DESC LIMIT 6`),
    getLeaderboard("level", { limit: 5 }),
    latestAchievements(6),
    getCurrentVote(),
  ]);
  return {
    servers,
    liveMatch: live[0] || null,
    featuredMaps: featuredMaps.map((r) => withDisplayFields({
      ...r,
      authors: parseJson(r.authors, []),
      contributors: parseJson(r.contributors, []),
      inferred_tags: parseJson(r.inferred_tags, []),
      custom_tags: parseJson(r.custom_tags, []),
      screenshots_from_repo: parseJson(r.screenshots_from_repo, []),
    })),
    recentMatches: recentMatches.map((r) => ({
      ...r,
      winners: parseJson(r.winners, []),
    })),
    topLevel,
    latestAchievements: latestAch,
    currentVote,
  };
}

