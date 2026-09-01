/**
 * services/webstore/catalog.js
 *
 * Storefront items (Stripe prices + their DB command templates) and the webstoreStripeCommands CRUD.
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 * Re-exported by the controllers/webstoreController.js barrel.
 */

import { query } from "./_shared.js";
import { fetchStripePrices, resolveStripePriceAmount } from "./stripe.js";

/**
 * Return all active Stripe items enriched with their command templates from
 * the webstoreStripeCommands table.  Prices are optionally converted to a
 * preferred currency.
 */
export async function getWebstoreItems(preferredCurrency = null) {
  const prices = await fetchStripePrices();

  const unexpanded = prices.filter((p) => typeof p.product === "string");
  if (unexpanded.length > 0) {
    console.warn(`[webstore] ${unexpanded.length} price(s) have an unexpanded product reference — they will be excluded from the storefront`);
  }

  const items = prices
    .filter((p) => p.active && typeof p.product === "object" && p.product?.active)
    .map((p) => {
      const { amount, currency } = resolveStripePriceAmount(p, preferredCurrency);
      const sortKey =
        typeof p.product?.metadata?.sortOrder === "string"
          ? Number(p.product.metadata.sortOrder) || 0
          : 0;
      return {
        slug: p.id,
        stripePriceId: p.id,
        displayName: p.product?.name || p.nickname || p.id,
        description: p.product?.description || "",
        imageUrl: p.product?.images?.[0] || null,
        priceCents: amount,
        currency,
        purchaseType: p.type === "recurring" || p.recurring ? "subscription" : "one_time",
        sortKey,
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.displayName.localeCompare(b.displayName));

  if (!items.length) return [];

  // Attach command entries from DB — each entry is { commandTemplate, commandType }
  const priceIds = items.map((i) => i.stripePriceId);
  const placeholders = priceIds.map(() => "?").join(",");
  const commands = await query(
    `SELECT stripePriceId, action, commandTemplate, commandType, serverSlug
     FROM webstoreStripeCommands
     WHERE stripePriceId IN (${placeholders})
     ORDER BY action ASC, sortOrder ASC, commandId ASC`,
    priceIds
  );

  const grantByPrice = {};
  const revokeByPrice = {};
  for (const cmd of commands) {
    const entry = { commandTemplate: cmd.commandTemplate, commandType: cmd.commandType || "minecraft", serverSlug: cmd.serverSlug || null };
    if (cmd.action === "revoke") {
      (revokeByPrice[cmd.stripePriceId] = revokeByPrice[cmd.stripePriceId] || []).push(entry);
    } else {
      (grantByPrice[cmd.stripePriceId] = grantByPrice[cmd.stripePriceId] || []).push(entry);
    }
  }

  return items.map((item) => ({
    ...item,
    grantCommands: grantByPrice[item.stripePriceId] || [],
    revokeCommands: revokeByPrice[item.stripePriceId] || [],
  }));
}

/** Find a single webstore item by its slug (= Stripe price ID). */
export async function findWebstoreItem(slug) {
  const items = await getWebstoreItems();
  return items.find((i) => i.slug === slug) || null;
}

/**
 * Fetch grant and revoke command templates for a Stripe price ID directly from
 * the DB (no Stripe API call).  Used during subscription renewal and revocation
 * where only the price ID is known.
 */
export async function getCommandsByPriceId(stripePriceId) {
  const rows = await query(
    `SELECT action, commandTemplate, commandType, serverSlug
     FROM webstoreStripeCommands
     WHERE stripePriceId = ?
     ORDER BY action ASC, sortOrder ASC, commandId ASC`,
    [stripePriceId]
  );
  const toEntry = (r) => ({ commandTemplate: r.commandTemplate, commandType: r.commandType || "minecraft", serverSlug: r.serverSlug || null });
  return {
    grantCommands: rows.filter((r) => r.action === "grant").map(toEntry),
    revokeCommands: rows.filter((r) => r.action === "revoke").map(toEntry),
  };
}

export async function getAllCommands() {
  return query(
    `SELECT commandId, stripePriceId, action, commandType, commandTemplate, serverSlug, sortOrder, createdAt
     FROM webstoreStripeCommands
     ORDER BY stripePriceId ASC, action ASC, sortOrder ASC`
  );
}

// ---------------------------------------------------------------------------
// Webstore command CRUD
// ---------------------------------------------------------------------------

export async function getCommandById(commandId) {
  const rows = await query(
    `SELECT commandId, stripePriceId, action, commandType, commandTemplate, serverSlug, sortOrder, createdAt
     FROM webstoreStripeCommands
     WHERE commandId = ?
     LIMIT 1`,
    [commandId]
  );
  return rows[0] || null;
}

export async function createCommand({ stripePriceId, action, commandType, commandTemplate, serverSlug, sortOrder }) {
  const result = await query(
    `INSERT INTO webstoreStripeCommands
       (stripePriceId, action, commandType, commandTemplate, serverSlug, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      stripePriceId,
      action,
      commandType || "minecraft",
      commandTemplate,
      serverSlug || null,
      parseInt(sortOrder, 10) || 0,
    ]
  );
  return result.insertId;
}

export async function updateCommand(commandId, { action, commandType, commandTemplate, serverSlug, sortOrder }) {
  return query(
    `UPDATE webstoreStripeCommands
     SET action = ?, commandType = ?, commandTemplate = ?, serverSlug = ?, sortOrder = ?
     WHERE commandId = ?`,
    [
      action,
      commandType || "minecraft",
      commandTemplate,
      serverSlug || null,
      parseInt(sortOrder, 10) || 0,
      commandId,
    ]
  );
}

export async function deleteCommand(commandId) {
  return query(
    "DELETE FROM webstoreStripeCommands WHERE commandId = ?",
    [commandId]
  );
}

