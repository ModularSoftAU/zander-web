/**
 * services/webstore/webhooks.js
 *
 * Stripe webhook-event idempotency log (webstoreWebhookEvents).
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 * Re-exported by the controllers/webstoreController.js barrel.
 */

import { query } from "./_shared.js";

/** Returns true if this Stripe event ID has already been processed. */
export async function hasWebhookEvent(stripeEventId) {
  const rows = await query(
    "SELECT webhookEventId FROM webstoreWebhookEvents WHERE stripeEventId = ? LIMIT 1",
    [stripeEventId]
  );
  return rows.length > 0;
}

export async function recordWebhookEvent({ stripeEventId, purchaseId, eventType, payload }) {
  return query(
    `INSERT INTO webstoreWebhookEvents (stripeEventId, purchaseId, eventType, payload)
     VALUES (?, ?, ?, ?)`,
    [stripeEventId, purchaseId || null, eventType, payload ? JSON.stringify(payload) : null]
  );
}

