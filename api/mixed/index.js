/**
 * api/mixed/index.js
 *
 * Registers the full Mixed API surface. Called from app.js AFTER session
 * middleware is registered so user/admin endpoints can read req.session.
 *
 * Auth model:
 *   - Ingestion endpoints require Bearer MIXED_PLUGIN_API_TOKEN.
 *   - Public GET endpoints are open.
 *   - User endpoints require a logged-in user with a linked Minecraft account.
 *   - Admin endpoints require the zander.web.mixed capability.
 *
 * The Stripe webhook (raw body) is registered separately in app.js.
 */

import mixedIngestionRoutes from "./ingestion.js";
import mixedPublicRoutes from "./public.js";
import mixedAdminRoutes from "./admin.js";
import { registerMixedStream } from "../../lib/mixedRealtime.js";

export default function mixedApiRoutes(app, features) {
  if (features && features.mixed === false) return;
  mixedIngestionRoutes(app);
  mixedPublicRoutes(app);
  mixedAdminRoutes(app);
  registerMixedStream(app);
}
