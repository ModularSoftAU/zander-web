/**
 * controllers/webstoreController.js
 *
 * Barrel for the Webstore data + fulfillment layer. Implementation moved to
 * services/webstore/store.js (Phase 7 decomposition), to be split from there
 * into per-concern modules. Every existing `.../webstoreController.js` import
 * keeps working via this re-export.
 */

export * from "../services/webstore/store.js";
