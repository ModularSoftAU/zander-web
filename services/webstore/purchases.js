/**
 * services/webstore/purchases.js
 *
 * webstorePurchases rows: pending-purchase creation, lookups, status/payment updates, history + received-gift listings.
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 * Re-exported by the controllers/webstoreController.js barrel.
 */

import { query } from "./_shared.js";

/**
 * Insert a pending purchase record when the user is redirected to Stripe.
 * Returns the new purchaseId.
 */
export async function createPendingPurchase({
  userId,
  item,
  purchaserMinecraftUsername,
  recipientMinecraftUsername,
  stripeSessionId,
  isGift,
}) {
  const result = await query(
    `INSERT INTO webstorePurchases
       (userId, itemSlug, itemName, purchaseType,
        purchaserMinecraftUsername, recipientMinecraftUsername,
        stripeSessionId, amountCents, currency, isGift)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      item.slug,
      item.displayName,
      item.purchaseType,
      purchaserMinecraftUsername,
      recipientMinecraftUsername,
      stripeSessionId,
      item.priceCents,
      item.currency,
      isGift ? 1 : 0,
    ]
  );
  return result.insertId;
}

export async function getPurchaseBySessionId(stripeSessionId) {
  const rows = await query(
    "SELECT * FROM webstorePurchases WHERE stripeSessionId = ? LIMIT 1",
    [stripeSessionId]
  );
  return rows[0] || null;
}

export async function getPurchaseById(purchaseId) {
  const rows = await query(
    "SELECT * FROM webstorePurchases WHERE purchaseId = ? LIMIT 1",
    [purchaseId]
  );
  return rows[0] || null;
}

/**
 * Update Stripe identifiers on a purchase and transition its status.
 */
export async function updatePurchasePayment({
  purchaseId,
  status,
  paymentIntentId,
  subscriptionId,
  customerId,
}) {
  return query(
    `UPDATE webstorePurchases
     SET status = ?, stripePaymentIntentId = ?,
         stripeSubscriptionId = ?, stripeCustomerId = ?, updatedAt = NOW()
     WHERE purchaseId = ?`,
    [status, paymentIntentId || null, subscriptionId || null, customerId || null, purchaseId]
  );
}

export async function updatePurchaseStatus(purchaseId, status) {
  return query(
    "UPDATE webstorePurchases SET status = ?, updatedAt = NOW() WHERE purchaseId = ?",
    [status, purchaseId]
  );
}

/**
 * Return paginated purchase history for a given user, newest first.
 */
export async function getPurchaseHistory(userId, limit = 20, offset = 0) {
  return query(
    `SELECT purchaseId, itemName, purchaseType, recipientMinecraftUsername,
            purchaserMinecraftUsername, amountCents, currency, isGift,
            status, createdAt
     FROM webstorePurchases
     WHERE userId = ?
     ORDER BY createdAt DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
}

export async function getPurchaseHistoryCount(userId) {
  const rows = await query(
    "SELECT COUNT(*) AS total FROM webstorePurchases WHERE userId = ?",
    [userId]
  );
  return Number(rows[0]?.total || 0);
}

/**
 * Return paginated gifts received by a Minecraft username from other players,
 * newest first.  Excludes self-purchases (isGift = 1 ensures it's a real gift).
 */
export async function getReceivedGifts(minecraftUsername, limit = 20, offset = 0) {
  return query(
    `SELECT purchaseId, itemName, purchaseType, purchaserMinecraftUsername,
            amountCents, currency, status, createdAt
     FROM webstorePurchases
     WHERE recipientMinecraftUsername = ? AND isGift = 1
     ORDER BY createdAt DESC
     LIMIT ? OFFSET ?`,
    [minecraftUsername, limit, offset]
  );
}

export async function getReceivedGiftsCount(minecraftUsername) {
  const rows = await query(
    "SELECT COUNT(*) AS total FROM webstorePurchases WHERE recipientMinecraftUsername = ? AND isGift = 1",
    [minecraftUsername]
  );
  return Number(rows[0]?.total || 0);
}

export async function getAllPurchases(limit = 20, offset = 0) {
  return query(
    `SELECT purchaseId, userId, itemName, purchaseType,
            purchaserMinecraftUsername, recipientMinecraftUsername,
            amountCents, currency, isGift, status, createdAt
     FROM webstorePurchases
     ORDER BY createdAt DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

export async function getAllPurchasesCount() {
  const rows = await query("SELECT COUNT(*) AS total FROM webstorePurchases");
  return Number(rows[0]?.total || 0);
}

