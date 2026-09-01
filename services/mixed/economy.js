/**
 * services/mixed/economy.js
 *
 * Map-token economy: balances, transactions (Stripe-idempotent credit), token-spend map requests, and map voting.
 *
 * Extracted from controllers/mixedController.js (Phase 7 decomposition).
 * Re-exported by the controllers/mixedController.js barrel.
 */

import {
  q, one, conn, toJson, parseJson, isValidUuid, normaliseUuid,
} from "./_shared.js";

export async function getTokenBalance(uuid) {
  const row = await one(`SELECT * FROM mixed_map_token_balances WHERE player_uuid = ?`, [uuid]);
  return row || { player_uuid: uuid, balance: 0, lifetime_earned: 0, lifetime_spent: 0 };
}

/**
 * Credit tokens to a player. Optionally tied to a Stripe session for idempotency
 * (the unique index on stripe_checkout_session_id prevents double credit).
 * Returns true if credited, false if the session was already processed.
 */
export async function creditTokens({ uuid, username, amount, type = "grant", reason, stripeSessionId, stripePaymentIntentId, metadata }) {
  const cx = await conn.getConnection();
  try {
    await cx.beginTransaction();
    try {
      await cx.query(
        `INSERT INTO mixed_map_token_transactions
           (player_uuid, type, amount, reason, stripe_checkout_session_id, stripe_payment_intent_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuid, type, amount, reason || null, stripeSessionId || null,
         stripePaymentIntentId || null, toJson(metadata)]
      );
    } catch (err) {
      if (err && err.code === "ER_DUP_ENTRY") {
        await cx.rollback();
        return false; // already processed this Stripe session
      }
      throw err;
    }
    await cx.query(
      `INSERT INTO mixed_map_token_balances (player_uuid, username, balance, lifetime_earned)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         balance = balance + VALUES(balance),
         lifetime_earned = lifetime_earned + VALUES(lifetime_earned),
         username = COALESCE(VALUES(username), username)`,
      [uuid, username || null, amount, amount]
    );
    await cx.commit();
    return true;
  } catch (err) {
    await cx.rollback();
    throw err;
  } finally {
    cx.release();
  }
}

export async function removeTokens({ uuid, amount, reason, type = "remove", metadata }) {
  const cx = await conn.getConnection();
  try {
    await cx.beginTransaction();
    const [balRows] = await cx.query(
      `SELECT balance FROM mixed_map_token_balances WHERE player_uuid = ? FOR UPDATE`, [uuid]
    );
    const balance = balRows[0]?.balance || 0;
    if (balance < amount) { await cx.rollback(); return { ok: false, balance }; }
    await cx.query(
      `INSERT INTO mixed_map_token_transactions (player_uuid, type, amount, reason, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [uuid, type, -Math.abs(amount), reason || null, toJson(metadata)]
    );
    await cx.query(
      `UPDATE mixed_map_token_balances
          SET balance = balance - ?, lifetime_spent = lifetime_spent + ?
        WHERE player_uuid = ?`,
      [amount, amount, uuid]
    );
    await cx.commit();
    return { ok: true, balance: balance - amount };
  } catch (err) {
    await cx.rollback();
    throw err;
  } finally {
    cx.release();
  }
}

export async function refundTokens({ uuid, amount, reason }) {
  return creditTokens({ uuid, amount, type: "refund", reason });
}

export async function getTokenTransactions(uuid, limit = 100) {
  const rows = await q(
    `SELECT * FROM mixed_map_token_transactions WHERE player_uuid = ? ORDER BY created_at DESC LIMIT ?`,
    [uuid, limit]
  );
  return rows.map((r) => ({ ...r, metadata: parseJson(r.metadata) }));
}

export async function listTokenBalances({ search, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (search) {
    if (isValidUuid(search)) { where.push(`player_uuid = ?`); params.push(normaliseUuid(search)); }
    else { where.push(`username LIKE ?`); params.push(`%${search}%`); }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return q(`SELECT * FROM mixed_map_token_balances ${whereSql} ORDER BY balance DESC LIMIT ?`,
    [...params, limit]);
}

// ---------------------------------------------------------------------------
// Map requests (token spends)
// ---------------------------------------------------------------------------

export async function createMapRequest({ uuid, username, mapKey, actionType, tokenCost }) {
  const res = await q(
    `INSERT INTO mixed_map_requests (player_uuid, username, map_key, action_type, token_cost, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [uuid, username || null, mapKey, actionType, tokenCost]
  );
  return getMapRequest(res.insertId);
}

export async function getMapRequest(id) {
  const row = await one(`SELECT * FROM mixed_map_requests WHERE id = ?`, [id]);
  if (row) row.metadata = parseJson(row.metadata);
  return row;
}

export async function listPendingMapRequests(limit = 50) {
  return q(
    `SELECT * FROM mixed_map_requests WHERE status IN ('pending','queued') ORDER BY requested_at ASC LIMIT ?`,
    [limit]
  );
}

export async function listPlayerMapRequests(uuid, limit = 50) {
  return q(`SELECT * FROM mixed_map_requests WHERE player_uuid = ? ORDER BY requested_at DESC LIMIT ?`,
    [uuid, limit]);
}

export async function setMapRequestStatus(id, status, { failureReason, appliedAt } = {}) {
  await q(
    `UPDATE mixed_map_requests
        SET status = ?,
            failure_reason = ?,
            applied_at = ${appliedAt ? "NOW()" : "applied_at"},
            refunded_at = ${status === "refunded" ? "NOW()" : "refunded_at"}
      WHERE id = ?`,
    [status, failureReason || null, id]
  );
  return getMapRequest(id);
}

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

export async function startVote({ voteId, serverId, options = [], metadata }) {
  await q(
    `INSERT INTO mixed_map_votes (vote_id, server_id, status, started_at, metadata)
     VALUES (?, ?, 'active', NOW(), ?)
     ON DUPLICATE KEY UPDATE status = 'active', started_at = NOW(), metadata = VALUES(metadata)`,
    [voteId, serverId || null, toJson(metadata)]
  );
  for (const opt of options) {
    await q(
      `INSERT INTO mixed_map_vote_options
         (vote_id, map_key, map_name, source, token_request_id, base_weight, token_boost_weight)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE map_name = VALUES(map_name), token_boost_weight = VALUES(token_boost_weight)`,
      [voteId, opt.map_key, opt.map_name || null, opt.source || "rotation",
       opt.token_request_id || null, opt.base_weight || 1, opt.token_boost_weight || 0]
    );
  }
  return getVote(voteId);
}

export async function getVote(voteId) {
  const vote = await one(`SELECT * FROM mixed_map_votes WHERE vote_id = ?`, [voteId]);
  if (!vote) return null;
  vote.metadata = parseJson(vote.metadata, {});
  const options = await q(
    `SELECT o.*, m.thumbnail_url, m.gamemode
       FROM mixed_map_vote_options o
       LEFT JOIN mixed_maps m ON m.map_key = o.map_key
      WHERE o.vote_id = ? ORDER BY o.final_vote_count DESC`, [voteId]
  );
  const winning = options[0] || null;
  return { ...vote, options, winning };
}

export async function getCurrentVote() {
  const active = await one(`SELECT vote_id FROM mixed_map_votes WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`);
  return active ? getVote(active.vote_id) : null;
}

export async function endVote(voteId, { status = "ended", winningMapKey } = {}) {
  await q(
    `UPDATE mixed_map_votes SET status = ?, ended_at = NOW(), winning_map_key = ? WHERE vote_id = ?`,
    [status, winningMapKey || null, voteId]
  );
  return getVote(voteId);
}

export async function castVote({ voteId, uuid, username, mapKey, weight = 1, source = "web" }) {
  const cx = await conn.getConnection();
  try {
    await cx.beginTransaction();
    const [voteRows] = await cx.query(
      `SELECT status FROM mixed_map_votes WHERE vote_id = ? FOR UPDATE`, [voteId]
    );
    if (!voteRows[0] || voteRows[0].status !== "active") {
      await cx.rollback();
      return { ok: false, reason: "Vote is not active." };
    }
    try {
      await cx.query(
        `INSERT INTO mixed_map_vote_casts (vote_id, player_uuid, username, map_key, vote_weight, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [voteId, uuid, username || null, mapKey, weight, source]
      );
    } catch (err) {
      if (err && err.code === "ER_DUP_ENTRY") {
        await cx.rollback();
        return { ok: false, reason: "You have already voted." };
      }
      throw err;
    }
    await cx.query(
      `UPDATE mixed_map_vote_options SET final_vote_count = final_vote_count + ?
        WHERE vote_id = ? AND map_key = ?`, [weight, voteId, mapKey]
    );
    await cx.commit();
    return { ok: true };
  } catch (err) {
    await cx.rollback();
    throw err;
  } finally {
    cx.release();
  }
}

export async function listVotes(limit = 25) {
  return q(`SELECT * FROM mixed_map_votes ORDER BY started_at DESC LIMIT ?`, [limit]);
}

export async function getMapVoteHistory(mapKey, limit = 10) {
  return q(
    `SELECT v.vote_id, v.status, v.started_at, v.winning_map_key, o.final_vote_count
       FROM mixed_map_vote_options o JOIN mixed_map_votes v ON v.vote_id = o.vote_id
      WHERE o.map_key = ? ORDER BY v.started_at DESC LIMIT ?`, [mapKey, limit]
  );
}

