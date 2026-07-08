/**
 * api/mixed/store.js
 *
 * Map Token store product catalogue. Stripe Price IDs are supplied via env so
 * no secret pricing data is hard-coded. All products credit Map Tokens on a
 * successful checkout.session.completed webhook.
 */

export const STORE_PRODUCTS = {
  tokens_1: {
    key: "tokens_1",
    name: "Map Token x1",
    tokenAmount: 1,
    mode: "payment",
    stripePriceId: process.env.STRIPE_PRICE_MAP_TOKEN_1 || null,
  },
  tokens_5: {
    key: "tokens_5",
    name: "Map Tokens x5",
    tokenAmount: 5,
    mode: "payment",
    stripePriceId: process.env.STRIPE_PRICE_MAP_TOKEN_5 || null,
  },
  tokens_10: {
    key: "tokens_10",
    name: "Map Tokens x10",
    tokenAmount: 10,
    mode: "payment",
    stripePriceId: process.env.STRIPE_PRICE_MAP_TOKEN_10 || null,
  },
  supporter_monthly: {
    key: "supporter_monthly",
    name: "Monthly Supporter + 3 Map Tokens",
    tokenAmount: 3,
    mode: "subscription",
    stripePriceId: process.env.STRIPE_PRICE_SUPPORTER_MONTHLY || null,
  },
};

export function listStoreProducts() {
  return Object.values(STORE_PRODUCTS);
}
