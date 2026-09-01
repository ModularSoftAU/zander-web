/**
 * controllers/mixedController.js
 *
 * Barrel for the Mixed module data-access layer. The implementation was moved
 * out of this file (Phase 7 decomposition) into services/mixed/store.js and is
 * being split from there into per-concern modules. Every existing
 * `import { ... } from ".../mixedController.js"` keeps working via this
 * re-export.
 */

export * from "../services/mixed/store.js";
