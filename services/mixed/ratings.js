/**
 * services/mixed/ratings.js
 *
 * Map ratings + written feedback (mixed_map_ratings / _rating_totals).
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import { q, one, sanitiseFeedback } from "./_shared.js";

export async function submitRating({ mapKey, matchId, uuid, username, rating, feedback }) {
  const clean = sanitiseFeedback(feedback);
  await q(
    `INSERT INTO mixed_map_ratings (map_key, match_id, player_uuid, username, overall_rating, feedback)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE overall_rating = VALUES(overall_rating), feedback = VALUES(feedback),
       updated_at = NOW()`,
    [mapKey, matchId, uuid, username || null, rating, clean]
  );
  await recomputeRatingTotals(mapKey);
  return getMapRatingTotals(mapKey);
}

export async function recomputeRatingTotals(mapKey) {
  const stats = await one(
    `SELECT COUNT(*) AS cnt, AVG(overall_rating) AS avg,
            SUM(overall_rating = 1) AS s1, SUM(overall_rating = 2) AS s2,
            SUM(overall_rating = 3) AS s3, SUM(overall_rating = 4) AS s4,
            SUM(overall_rating = 5) AS s5,
            SUM(feedback IS NOT NULL AND feedback <> '') AS fb
       FROM mixed_map_ratings WHERE map_key = ?`, [mapKey]
  );
  await q(
    `INSERT INTO mixed_map_rating_totals
       (map_key, rating_count, average_overall, one_star_count, two_star_count,
        three_star_count, four_star_count, five_star_count, feedback_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rating_count = VALUES(rating_count), average_overall = VALUES(average_overall),
       one_star_count = VALUES(one_star_count), two_star_count = VALUES(two_star_count),
       three_star_count = VALUES(three_star_count), four_star_count = VALUES(four_star_count),
       five_star_count = VALUES(five_star_count), feedback_count = VALUES(feedback_count)`,
    [mapKey, stats.cnt || 0, stats.avg || 0, stats.s1 || 0, stats.s2 || 0,
     stats.s3 || 0, stats.s4 || 0, stats.s5 || 0, stats.fb || 0]
  );
}

export async function getMapRatingTotals(mapKey) {
  const row = await one(`SELECT * FROM mixed_map_rating_totals WHERE map_key = ?`, [mapKey]);
  return row || {
    map_key: mapKey, rating_count: 0, average_overall: 0,
    one_star_count: 0, two_star_count: 0, three_star_count: 0,
    four_star_count: 0, five_star_count: 0, feedback_count: 0,
  };
}

export async function getMapFeedback(mapKey, { publicOnly = true, limit = 20 } = {}) {
  const where = [`map_key = ?`, `feedback IS NOT NULL`, `feedback <> ''`];
  const params = [mapKey];
  if (publicOnly) where.push(`feedback_visible = 1`);
  return q(
    `SELECT id, map_key, match_id, player_uuid, username, overall_rating, feedback,
            feedback_visible, feedback_hidden_reason, created_at
       FROM mixed_map_ratings WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC LIMIT ?`, [...params, limit]
  );
}

export async function listAllFeedback({ mapKey, rating, playerUuid, matchId, limit = 100 } = {}) {
  const where = [`feedback IS NOT NULL`, `feedback <> ''`];
  const params = [];
  if (mapKey) { where.push(`map_key = ?`); params.push(mapKey); }
  if (rating) { where.push(`overall_rating = ?`); params.push(rating); }
  if (playerUuid) { where.push(`player_uuid = ?`); params.push(playerUuid); }
  if (matchId) { where.push(`match_id = ?`); params.push(matchId); }
  return q(
    `SELECT * FROM mixed_map_ratings WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
    [...params, limit]
  );
}

export async function setFeedbackVisibility(ratingId, visible, reason) {
  await q(
    `UPDATE mixed_map_ratings SET feedback_visible = ?, feedback_hidden_reason = ? WHERE id = ?`,
    [visible ? 1 : 0, reason || null, ratingId]
  );
  const row = await one(`SELECT map_key FROM mixed_map_ratings WHERE id = ?`, [ratingId]);
  if (row) await recomputeRatingTotals(row.map_key);
  return row;
}

export async function deleteRating(ratingId) {
  const row = await one(`SELECT map_key FROM mixed_map_ratings WHERE id = ?`, [ratingId]);
  await q(`DELETE FROM mixed_map_ratings WHERE id = ?`, [ratingId]);
  if (row) await recomputeRatingTotals(row.map_key);
  return row;
}

export async function resetMapRatings(mapKey) {
  await q(`DELETE FROM mixed_map_ratings WHERE map_key = ?`, [mapKey]);
  await recomputeRatingTotals(mapKey);
}

export async function ratingsOverview() {
  const [highest, lowest, fewRatings] = await Promise.all([
    q(`SELECT rt.*, m.name FROM mixed_map_rating_totals rt JOIN mixed_maps m ON m.map_key = rt.map_key
        WHERE rt.rating_count >= 5 ORDER BY rt.average_overall DESC LIMIT 10`),
    q(`SELECT rt.*, m.name FROM mixed_map_rating_totals rt JOIN mixed_maps m ON m.map_key = rt.map_key
        WHERE rt.rating_count >= 5 ORDER BY rt.average_overall ASC LIMIT 10`),
    q(`SELECT rt.*, m.name FROM mixed_map_rating_totals rt JOIN mixed_maps m ON m.map_key = rt.map_key
        WHERE rt.rating_count < 5 ORDER BY rt.rating_count ASC LIMIT 10`),
  ]);
  return { highest, lowest, fewRatings };
}

/** True when a player participated in a match (required before rating). */
export async function didPlayerPlayMatch(uuid, matchId) {
  const row = await one(
    `SELECT 1 FROM mixed_match_players WHERE match_id = ? AND player_uuid = ? LIMIT 1`,
    [matchId, uuid]
  );
  return Boolean(row);
}

