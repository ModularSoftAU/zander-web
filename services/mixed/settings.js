/**
 * services/mixed/settings.js
 *
 * Mixed module settings row (mixed_settings).
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import { q } from "./_shared.js";

export async function getSettings() {
  const row = await one(`SELECT * FROM mixed_settings WHERE id = 1`);
  return row || {};
}

export async function updateSettings(patch) {
  const allowed = [
    "vote_duration_seconds", "vote_options_count", "map_cooldown_minutes",
    "token_nominate_cost", "token_set_next_cost", "token_sponsor_cost",
    "token_boost_weight", "player_cooldown_minutes", "allow_web_voting",
    "public_feedback_enabled",
  ];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      params.push(patch[key]);
    }
  }
  if (!sets.length) return getSettings();
  await q(`UPDATE mixed_settings SET ${sets.join(", ")} WHERE id = 1`, params);
  return getSettings();
}

