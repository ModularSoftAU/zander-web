/**
 * services/webstore/transactions.js
 *
 * webstoreTransactions audit ledger + revenue/monthly totals.
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 * Re-exported by the controllers/webstoreController.js barrel.
 */

import { query } from "./_shared.js";

/**
 * Record an outgoing transaction for the purchaser, plus an incoming
 * transaction for the recipient if they have a registered account (gift case).
 */
export async function createTransactionsForPurchase({
  purchaseId,
  payerUserId,
  payerMinecraftUsername,
  recipientMinecraftUsername,
  amountCents,
  currency,
}) {
  // Outgoing for the payer
  await query(
    `INSERT INTO webstoreTransactions
       (purchaseId, userId, direction, counterpartyMinecraftUsername, amountCents, currency)
     VALUES (?, ?, 'outgoing', ?, ?, ?)`,
    [purchaseId, payerUserId, recipientMinecraftUsername, amountCents, currency]
  );

  // Incoming for the recipient — only if it's a gift to a registered user
  if (payerMinecraftUsername !== recipientMinecraftUsername) {
    const rows = await query(
      "SELECT userId FROM users WHERE username = ? LIMIT 1",
      [recipientMinecraftUsername]
    );
    const recipientUserId = rows?.[0]?.userId;
    if (recipientUserId) {
      await query(
        `INSERT INTO webstoreTransactions
           (purchaseId, userId, direction, counterpartyMinecraftUsername, amountCents, currency)
         VALUES (?, ?, 'incoming', ?, ?, ?)`,
        [purchaseId, recipientUserId, payerMinecraftUsername, amountCents, currency]
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Monthly totals (for the Give / Support page goal bar)
// ---------------------------------------------------------------------------

export async function getMonthlyPurchaseTotals(startDate, endDate) {
  const results = await query(
    `SELECT COALESCE(SUM(amountCents), 0) AS totalCents
     FROM webstorePurchases
     WHERE status IN ('paid', 'fulfilled')
       AND createdAt BETWEEN ? AND ?`,
    [startDate, endDate]
  );
  return Number(results[0]?.totalCents || 0);
}

export async function getTotalRevenueCents() {
  const rows = await query(
    `SELECT COALESCE(SUM(amountCents), 0) AS total
     FROM webstorePurchases
     WHERE status IN ('paid', 'fulfilled')`
  );
  return Number(rows[0]?.total || 0);
}

