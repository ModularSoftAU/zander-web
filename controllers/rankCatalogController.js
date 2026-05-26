import db from "./databaseController.js";
import { fetchStripePrices, resolveStripePriceAmount, formatPrice } from "./webstoreController.js";

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

function parsePerks(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export async function getAllCatalogEntries() {
  const rows = await query(
    `SELECT id, stripePriceId, displayName, description, imageUrl,
            category, categorySortOrder, sortOrder, perks, createdAt, updatedAt
     FROM rankCatalog
     ORDER BY categorySortOrder ASC, sortOrder ASC, displayName ASC`
  );
  return rows.map((r) => ({ ...r, perks: parsePerks(r.perks) }));
}

export async function getCatalogEntry(id) {
  const rows = await query(
    `SELECT id, stripePriceId, displayName, description, imageUrl,
            category, categorySortOrder, sortOrder, perks, createdAt, updatedAt
     FROM rankCatalog WHERE id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return { ...r, perks: parsePerks(r.perks) };
}

export async function createCatalogEntry({ stripePriceId, displayName, description, imageUrl, category, categorySortOrder, sortOrder, perks }) {
  const result = await query(
    `INSERT INTO rankCatalog (stripePriceId, displayName, description, imageUrl, category, categorySortOrder, sortOrder, perks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      stripePriceId || null,
      displayName,
      description || null,
      imageUrl || null,
      category || "Ranks",
      Number(categorySortOrder) || 0,
      Number(sortOrder) || 0,
      JSON.stringify(Array.isArray(perks) ? perks : []),
    ]
  );
  return result.insertId;
}

export async function updateCatalogEntry(id, { stripePriceId, displayName, description, imageUrl, category, categorySortOrder, sortOrder, perks }) {
  await query(
    `UPDATE rankCatalog
     SET stripePriceId = ?, displayName = ?, description = ?, imageUrl = ?,
         category = ?, categorySortOrder = ?, sortOrder = ?, perks = ?, updatedAt = NOW()
     WHERE id = ?`,
    [
      stripePriceId || null,
      displayName,
      description || null,
      imageUrl || null,
      category || "Ranks",
      Number(categorySortOrder) || 0,
      Number(sortOrder) || 0,
      JSON.stringify(Array.isArray(perks) ? perks : []),
      id,
    ]
  );
}

export async function deleteCatalogEntry(id) {
  await query(`DELETE FROM rankCatalog WHERE id = ?`, [id]);
}

/**
 * Returns the catalog grouped by category, with Stripe price info merged in.
 * Used by the public /ranks page.
 */
export async function getRankCatalogForPublicPage(preferredCurrency = null) {
  const entries = await getAllCatalogEntries();
  if (!entries.length) return [];

  // Build a Stripe price map for entries that have a stripePriceId
  const neededIds = new Set(entries.map((e) => e.stripePriceId).filter(Boolean));
  const priceMap = {};

  if (neededIds.size > 0) {
    try {
      const prices = await fetchStripePrices();
      for (const p of prices) {
        if (neededIds.has(p.id)) {
          const { amount, currency } = resolveStripePriceAmount(p, preferredCurrency);
          priceMap[p.id] = {
            priceCents: amount,
            currency,
            purchaseType: p.type === "recurring" || p.recurring ? "subscription" : "one_time",
          };
        }
      }
    } catch (err) {
      console.error("[rankCatalog] Failed to fetch Stripe prices for public page:", err.message);
    }
  }

  // Enrich entries and group by category
  const categoryMap = new Map();
  for (const entry of entries) {
    const stripeInfo = entry.stripePriceId ? priceMap[entry.stripePriceId] : null;
    const purchaseType = stripeInfo?.purchaseType || "one_time";
    const pkg = {
      ...entry,
      priceCents: stripeInfo?.priceCents ?? null,
      currency: stripeInfo?.currency ?? "usd",
      purchaseType,
      priceDisplay: stripeInfo ? formatPrice(stripeInfo.priceCents, stripeInfo.currency) : null,
      badgeLabel: purchaseType === "subscription" ? "Monthly" : "One-time",
    };

    if (!categoryMap.has(entry.category)) {
      categoryMap.set(entry.category, { sortOrder: entry.categorySortOrder, packages: [] });
    }
    categoryMap.get(entry.category).packages.push(pkg);
  }

  return Array.from(categoryMap.entries())
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([name, { packages }]) => ({ displayName: name, packages }));
}
