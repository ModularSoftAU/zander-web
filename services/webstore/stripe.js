/**
 * services/webstore/stripe.js
 *
 * Stripe REST API helpers: price catalogue fetch, currency resolution, subscription fetch, Checkout session creation.
 *
 * Extracted from controllers/webstoreController.js (Phase 7 decomposition).
 * Re-exported by the controllers/webstoreController.js barrel.
 */

import fetch from "node-fetch";

/**
 * Fetch all active Stripe prices with expanded product data.
 * Uses cursor pagination to handle large catalogs.
 */
export async function fetchStripePrices() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  const prices = [];
  let startingAfter = null;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({ limit: "100", active: "true" });
    params.append("expand[]", "data.product");
    if (startingAfter) params.append("starting_after", startingAfter);

    const response = await fetch(`https://api.stripe.com/v1/prices?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Stripe API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    prices.push(...(data.data || []));
    hasMore = Boolean(data.has_more);
    startingAfter = data.data?.length ? data.data[data.data.length - 1].id : null;
  }

  return prices;
}

/**
 * Resolve the best price amount for a requested currency, falling back to the
 * price's default currency when the preferred one is not available.
 */
export function resolveStripePriceAmount(price, preferredCurrency) {
  if (preferredCurrency) {
    const key = preferredCurrency.toLowerCase();
    const opt = price.currency_options?.[key];
    if (opt?.unit_amount) return { amount: opt.unit_amount, currency: key };
  }
  return { amount: price.unit_amount || 0, currency: price.currency || "usd" };
}

/**
 * Fetch a single Stripe subscription object.
 * Returns null on failure so callers can proceed without period data.
 */
export async function fetchStripeSubscription(subscriptionId) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey || !subscriptionId) return null;

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Create a Stripe Checkout session and return the session object.
 */
export async function createStripeCheckoutSession({
  item,
  userId,
  recipientMinecraftUsername,
  purchaserMinecraftUsername,
  isGift,
}) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  const mode = item.purchaseType === "subscription" ? "subscription" : "payment";

  const body = new URLSearchParams();
  body.append("mode", mode);
  body.append("line_items[0][price]", item.stripePriceId);
  body.append("line_items[0][quantity]", "1");
  body.append(
    "success_url",
    `${process.env.siteAddress}/webstore/thank-you?session_id={CHECKOUT_SESSION_ID}`
  );
  body.append("cancel_url", `${process.env.siteAddress}/webstore?canceled=1`);
  body.append("client_reference_id", String(userId));
  // Store metadata so the webhook can retrieve context without another API call
  body.append("metadata[itemSlug]", item.slug);
  body.append("metadata[userId]", String(userId));
  body.append("metadata[recipientUsername]", recipientMinecraftUsername);
  body.append("metadata[purchaserUsername]", purchaserMinecraftUsername);
  body.append("metadata[isGift]", isGift ? "true" : "false");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stripe checkout session error ${response.status}: ${text}`);
  }

  return response.json();
}

