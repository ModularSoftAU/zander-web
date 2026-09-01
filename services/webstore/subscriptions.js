/**
 * services/webstore/subscriptions.js
 *
 * webstoreSubscriptions lifecycle rows.
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 * Re-exported by the controllers/webstoreController.js barrel.
 */

import { query } from "./_shared.js";

/**
 * Create or update a subscription record.  Uses INSERT … ON DUPLICATE KEY
 * UPDATE so it is safe to call on renewal events.
 */
export async function upsertSubscription({
  purchaseId,
  stripeSubscriptionId,
  stripeCustomerId,
  stripePriceId,
  recipientMinecraftUsername,
  purchaserMinecraftUsername,
  purchaserUserId,
  status,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}) {
  return query(
    `INSERT INTO webstoreSubscriptions
       (purchaseId, stripeSubscriptionId, stripeCustomerId, stripePriceId,
        recipientMinecraftUsername, purchaserMinecraftUsername, purchaserUserId,
        status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status             = VALUES(status),
       currentPeriodStart = VALUES(currentPeriodStart),
       currentPeriodEnd   = VALUES(currentPeriodEnd),
       cancelAtPeriodEnd  = VALUES(cancelAtPeriodEnd),
       stripeCustomerId   = VALUES(stripeCustomerId),
       updatedAt          = NOW()`,
    [
      purchaseId,
      stripeSubscriptionId,
      stripeCustomerId || null,
      stripePriceId,
      recipientMinecraftUsername,
      purchaserMinecraftUsername,
      purchaserUserId,
      status,
      currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
      currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd ? 1 : 0,
    ]
  );
}

export async function getSubscriptionByStripeId(stripeSubscriptionId) {
  const rows = await query(
    "SELECT * FROM webstoreSubscriptions WHERE stripeSubscriptionId = ? LIMIT 1",
    [stripeSubscriptionId]
  );
  return rows[0] || null;
}

export async function updateSubscriptionStatus(stripeSubscriptionId, status, cancelledAt = null) {
  return query(
    `UPDATE webstoreSubscriptions
     SET status = ?, cancelledAt = ?, updatedAt = NOW()
     WHERE stripeSubscriptionId = ?`,
    [status, cancelledAt, stripeSubscriptionId]
  );
}

export async function updateSubscriptionPeriod(stripeSubscriptionId, currentPeriodStart, currentPeriodEnd) {
  return query(
    `UPDATE webstoreSubscriptions
     SET currentPeriodStart = ?, currentPeriodEnd = ?, status = 'active', updatedAt = NOW()
     WHERE stripeSubscriptionId = ?`,
    [
      currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
      currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      stripeSubscriptionId,
    ]
  );
}

export async function getActiveSubscriptionsCount() {
  const rows = await query(
    "SELECT COUNT(*) AS total FROM webstoreSubscriptions WHERE status = 'active'"
  );
  return Number(rows[0]?.total || 0);
}

