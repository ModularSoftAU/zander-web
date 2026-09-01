/**
 * controllers/userController.js
 *
 * Barrel for the user data-access layer (incl. the UserGetter class).
 * Implementation moved to services/user/store.js (Phase 7 decomposition), to be
 * split from there into per-concern modules. Every existing
 * `.../userController.js` import keeps working via this re-export.
 */

export * from "../services/user/store.js";
