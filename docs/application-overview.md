# Application and API Overview

This document summarizes how the Zander web service is structured, configured, and exposed to users through the website and the API. It complements the targeted crash reporting guide in `docs/crash-reporting.md` by covering the remainder of the application surface area.

## Runtime architecture

- **Fastify application**: `app.js` boots Fastify with EJS templating, static asset handling, and URL-encoded form parsing. It registers the public crash report endpoint, authenticated API routes, redirect helpers, and website pages, and seeds a session middleware backed by signed cookies. 404 and error handlers render EJS views and, when enabled, forward crash information via `sendCrashReport`.【F:app.js†L63-L191】
- **Feature flags**: `features.json` gates both API and web routes (e.g., `announcements`, `applications`, `server`, `report`, `shopdirectory`, `vault`, `bridge`, `filter`, `web.login/register`, social icons, and crash reports). Each route checks the flag before serving traffic.【F:features.json†L1-L36】【F:routes/index.js†L52-L188】
- **Background tasks**: Cron jobs for user code expiry, bridge cleanup, Discord stats, cake day checks, and staff audit reports are bootstrapped during startup, along with the Discord controller integration for webhook and guild interactions.【F:app.js†L30-L58】

## Configuration and environment

- **Configuration file**: `config.json.example` documents site metadata, policy URLs, platform links, and Discord webhook channels (welcome, chat log, admin log, staff channel, staff audit log, and crash reports) plus the guild and verification role IDs.【F:config.json.example†L1-L40】
- **Environment variables**: The server expects `PORT` for binding, `sessionCookieSecret` for signed sessions and cookies, `siteAddress` for internal API-to-frontend calls, and `apiKey` for token authentication when server-side pages call the JSON API. `.env` handling is enabled via `dotenv`.【F:app.js†L10-L31】【F:routes/index.js†L31-L188】

## Website surface

The site is delivered with EJS templates and backed by server-side API calls to keep pages in sync with the JSON endpoints.

- **Home**: `/` renders statistics pulled from `/api/web/statistics` along with announcements and global imagery.【F:routes/index.js†L31-L47】
- **Play**: `/play` lists externally visible servers from `/api/server/get?type=EXTERNAL`, gated by the `server` feature flag.【F:routes/index.js†L52-L70】
- **Apply**: `/apply` surfaces available applications fetched from `/api/application/get`, gated by the `applications` feature flag.【F:routes/index.js†L72-L94】
- **Ranks**: `/ranks` displays static ranks from `ranks.json` when the `ranks` feature is enabled.【F:routes/index.js†L95-L110】
- **Report**: `/report` requires a logged-in session and the `report` feature, rendering a reporting form for authenticated users.【F:routes/index.js†L112-L139】
- **Shop Directory**: `/shopdirectory` fetches shop data from `/api/shop/get` and renders the directory when enabled.【F:routes/index.js†L141-L165】
- **Vault**: `/vault` pulls `/api/vault/get` for a public vault listing when the feature flag is enabled.【F:routes/index.js†L167-L188】
- **Session flows**: `routes/sessionRoutes.js` implements login (site and Discord OAuth), logout, password reset (request/verify/reset), and multi-step registration (account, email verification, Minecraft link, unregistered handling). Each path has paired GET/POST handlers and uses feature flags under `features.web` to allow or disallow self-service access.【F:routes/sessionRoutes.js†L117-L905】
- **Profile and dashboard**: Additional page modules in `routes/profileRoutes.js` and `routes/dashboard` expose user profiles and admin/staff dashboards. They rely on shared helpers for feature gating and stat fetching to render the views alongside announcements and global imagery.【F:routes/index.js†L25-L30】
- **Policies and redirects**: Routes in `routes/policyRoutes.js` and `routes/redirectRoutes.js` supply static policy renderers and friendly redirects to configured platform URLs. Feature toggles control whether specific redirects are available.【F:routes/index.js†L7-L30】【F:config.json.example†L4-L40】

## API surface

All authenticated API routes are mounted under `/api/*` and protected with the `verifyToken` pre-validation hook, except for the public crash report endpoint and internal redirect helpers. Each route module uses feature flags before touching the database or returning data.

- **Heartbeat**: `GET /api/heartbeat` returns `{ success: true }` for monitoring.【F:api/routes/index.js†L28-L33】
- **Announcements**: CRUD endpoints under `/api/announcement/*` allow fetching by ID/type/visibility and managing announcements; operations log actions via `generateLog`.【F:api/routes/announcement.js†L8-L255】
- **Applications**: `/api/application/get` lists applications (optionally by ID), while `/create`, `/edit`, and `/delete` manage the lifecycle and log actions.【F:api/routes/application.js†L8-L247】
- **Bridge**: `/api/bridge/get` and `/remove` manage cross-system bridge records; the cleanup cron also prunes stale entries at boot.【F:api/routes/bridge.js†L6-L180】【F:app.js†L48-L58】
- **Discord**: `/api/discord/send` and related endpoints integrate with Discord webhooks and role assignments, using guild IDs and webhooks from `config.json` and feature flags under `features.discord.events`.【F:api/routes/discord.js†L6-L259】【F:config.json.example†L19-L28】
- **Filter**: `/api/filter/get`, `/link/create`, `/link/delete`, `/phrase/create`, and `/phrase/delete` manage prohibited links and phrases for moderation, guarded by `features.filter.link/phrase`.【F:api/routes/filter.js†L6-L274】【F:features.json†L18-L21】
- **Ranks**: `/api/ranks/get` exposes configured ranks, while `/create` and `/delete` allow management when the feature is enabled.【F:api/routes/ranks.js†L6-L160】
- **Report**: `/api/report/create` persists player reports and posts administrative audit logs, honoring the `report` feature flag.【F:api/routes/report.js†L6-L143】【F:features.json†L14-L15】
- **Servers**: `/api/server/get` queries servers (with `type` filters such as `EXTERNAL`), and `/create`, `/edit`, `/delete` mutate server records with audit logging.【F:api/routes/server.js†L8-L235】
- **Sessions**: `/api/session/login`, `/register`, `/logout`, and `/discord` endpoints coordinate account creation, credential verification, and Discord linking for the web authentication flows.【F:api/routes/session.js†L6-L372】
- **Shop Directory**: `/api/shop/get`, `/create`, `/edit`, `/delete` handle shop listings surfaced in the web directory.【F:api/routes/shopdirectory.js†L6-L225】
- **Users**: `/api/user/get` (with query filters), `/create`, `/edit`, and `/delete` support user lookup and administration, plus helper endpoints for password resets and email verification tokens.【F:api/routes/user.js†L6-L375】
- **Vault**: `/api/vault/get`, `/create`, `/edit`, `/delete` provide read/write access to vault entries displayed on the website.【F:api/routes/vault.js†L6-L226】
- **Web**: `/api/web/statistics` returns aggregated counts for the homepage; `/api/web/contact` and related endpoints route contact and support submissions.【F:api/routes/web.js†L6-L230】
- **Crash reports**: `/api/crash-report` accepts unauthenticated user-initiated error submissions, while the global error handler forwards server-side exceptions to the crash reporting controller when enabled. See `docs/crash-reporting.md` for the complete lifecycle.【F:api/routes/crashReport.js†L1-L158】【F:app.js†L80-L115】

## Logging, monitoring, and safety nets

- **Crash reporting**: Built-in hooks capture Fastify errors and user-submitted crashes; Discord webhook formatting and configuration details are fully documented in `docs/crash-reporting.md`.
- **Audit logging**: Mutating API endpoints invoke `generateLog` with action types and actors to keep an administrative audit trail across announcements, applications, servers, ranks, filters, shops, vault, and report handling.【F:api/routes/announcement.js†L128-L239】【F:api/routes/application.js†L101-L231】【F:api/routes/server.js†L81-L234】
- **Access control**: Token verification middleware (`verifyToken`) protects the API, while web routes rely on session cookies. Feature flags prevent disabled modules from serving content or accepting writes.【F:app.js†L137-L167】【F:routes/index.js†L52-L188】

## Related references

- Crash reporting specifics: `docs/crash-reporting.md`
- Feature toggles: `features.json`
- Sample configuration: `config.json.example`
