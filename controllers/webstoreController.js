/**
 * controllers/webstoreController.js
 *
 * Barrel for the Webstore data + fulfillment layer. Implementation lives in
 * per-concern modules under services/webstore/ (Phase 7 decomposition):
 *
 *   _shared.js       — private query() helper (not re-exported)
 *   stripe.js        — Stripe REST helpers + Checkout session
 *   pricing.js       — locale/currency + command-template helpers
 *   catalog.js       — storefront items + webstoreStripeCommands CRUD
 *   purchases.js     — webstorePurchases rows + history
 *   subscriptions.js — webstoreSubscriptions lifecycle
 *   webhooks.js      — Stripe event idempotency log
 *   transactions.js  — audit ledger + revenue totals
 *   fulfillment.js   — command queue / Discord roles / fulfill-renew-revoke
 */

export * from "../services/webstore/stripe.js";
export * from "../services/webstore/pricing.js";
export * from "../services/webstore/catalog.js";
export * from "../services/webstore/purchases.js";
export * from "../services/webstore/subscriptions.js";
export * from "../services/webstore/webhooks.js";
export * from "../services/webstore/transactions.js";
export * from "../services/webstore/fulfillment.js";
