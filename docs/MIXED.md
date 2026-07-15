# Mixed module (zander-web)

**Mixed** is the public Minecraft PGM server brand. This module turns
`zander-web` into the public stats portal, map browser, match history,
leaderboard system, map voting hub, map rating system, Map Token store and
admin control panel for Mixed. Data is pushed in by the **zander-pgm** plugin
(built separately — not part of this repo).

- Public section: **`/mixed`**
- Admin section: **`/dashboard/mixed`** (reuses the existing admin chrome; the
  admin JSON API lives under **`/api/admin/mixed`** as specified)
- Plugin ingestion + public/user API: **`/api/mixed/*`**
- Map Token Stripe webhook: **`POST /api/stripe/webhook`**
- Live updates (SSE): **`GET /api/mixed/stream`**

The module is gated by the `mixed` flag in `features.json`.

## What this module does

Receives live and historical PGM data from zander-pgm and presents:

- Live match dashboard, match history and match detail pages
- Map browser + map detail (ratings, feedback, win-rates, vote/token history)
- Player browser + player profiles, leaderboards and achievements
- Server status
- Map voting (with web voting for linked accounts)
- Post-match map ratings and optional player feedback
- Map Tokens, a Stripe-powered Map Token store, and token-driven map requests
- Rank sync and entitlement management (admin)

## Intentionally excluded

Per product scope, this module contains **no** moderation, punishments, bans,
mutes, warnings, reports, punishment GUIs, punishment-evasion detection, or
**chat-tag management**. Ranks and entitlements are supported, but chat tags are
not.

## How zander-pgm sends data

All ingestion endpoints require a **Bearer token** in the `Authorization`
header equal to the app-wide `apiKey` — the same token used by every other
internal integration in this codebase. There is no separate Mixed-specific
plugin token. It is never exposed to the browser.

```
Authorization: Bearer <apiKey>
```

Ingestion endpoints:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/mixed/servers/heartbeat` | Upsert server status (marks online) |
| POST | `/api/mixed/servers/offline`   | Mark a server offline |
| POST | `/api/mixed/events`            | Single match event |
| POST | `/api/mixed/events/batch`      | `{ events: [...] }` |
| POST | `/api/mixed/stats/player`      | Upsert aggregate player totals |
| POST | `/api/mixed/stats/match`       | Upsert a match (+ `players[]`) |
| POST | `/api/mixed/stats/map`         | Upsert map metadata |
| POST | `/api/mixed/xp`                | Update player level/XP |
| POST | `/api/mixed/achievements`      | Define/unlock achievements |
| POST | `/api/mixed/ranks/sync`        | Record a synced rank |
| POST | `/api/mixed/entitlements/sync` | Mark entitlements synced |
| GET  | `/api/mixed/map-token-requests/pending` | Requests to act on in game |
| POST | `/api/mixed/map-token-requests/:id/result` | Report a request outcome |

Incoming plugin event types are stored on `mixed_match_events` and fanned out
over SSE: `SERVER_ONLINE`, `HEARTBEAT`, `MATCH_LOADED/STARTED/ENDED`,
`PLAYER_DEATH`, `OBJECTIVE_EVENT`, `LIVE_FEED_EVENT`, the `MAP_VOTE_*` family,
`MAP_RATING_*` and the `MAP_REQUEST_*` family.

## Required API token setup

1. Ensure `apiKey` is set in `.env` (shared with the rest of the app's internal integrations).
2. Configure zander-pgm's `api.token` to the same value; it is sent as a Bearer token on every ingestion call.

## How Map Tokens work

- Balances live in `mixed_map_token_balances`; every change is a row in
  `mixed_map_token_transactions` (`purchase`, `spend`, `grant`, `remove`,
  `refund`).
- A linked Minecraft account is required to earn or spend tokens.
- Spending a token creates a `mixed_map_requests` row (`nominate`, `set_next`,
  `sponsor`). Tokens are deducted up-front. The plugin polls pending requests,
  acts on them, and reports the result. Rejected/failed/expired requests are
  **automatically refunded**.
- Token buttons on a map are disabled when the user is not logged in, has no
  linked account, has insufficient balance, or the map is disabled/blacklisted.
- Admins can grant/remove tokens and refund requests; grants, removals and
  refunds are written to the audit `logs` table.

## How Stripe fulfilment works

1. `POST /api/mixed/store/checkout` creates a Stripe Checkout Session. A linked
   Minecraft account is required. Session metadata carries:
   ```json
   { "zander_user_id": "123", "minecraft_uuid": "player-uuid",
     "product_type": "map_tokens", "token_amount": "5" }
   ```
2. Stripe calls `POST /api/stripe/webhook` on `checkout.session.completed`.
3. The webhook **verifies the HMAC signature**, records the event id in
   `mixed_stripe_webhook_events` (idempotency), confirms
   `product_type = map_tokens`, reads `token_amount`, credits the balance and
   inserts a `purchase` transaction storing the checkout session id and payment
   intent id. A unique index on the session id makes double-crediting
   impossible even under duplicate deliveries.

Store products (`Map Token x1/5/10`, `Monthly Supporter + 3 Map Tokens`) map to
Stripe Price IDs via `STRIPE_PRICE_MAP_TOKEN_1/5/10` and
`STRIPE_PRICE_SUPPORTER_MONTHLY`.

## How Map Voting works

- Votes live in `mixed_map_votes` with `mixed_map_vote_options` and
  `mixed_map_vote_casts` (unique per vote+player).
- The current vote is shown at `/mixed/vote`. Web voting requires a logged-in,
  linked account and `allow_web_voting` in `mixed_settings`.
- Token-nominated and token-boosted options are flagged on the option rows.
- Admins start/end/cancel votes and tune durations/costs/cooldowns from
  `/dashboard/mixed/voting`.

## How Map Ratings and feedback work

- One rating per player per match (`mixed_map_ratings`, unique on
  `match_id + player_uuid`). A player must have participated in the match.
- Aggregates are recomputed into `mixed_map_rating_totals` (average + star
  distribution) on every change.
- Feedback is HTML-stripped before storage and only shown publicly when
  `feedback_visible` and `public_feedback_enabled` are set.
- Admins review all feedback, hide or delete abusive feedback, and reset a
  map's ratings from `/dashboard/mixed/ratings`. This is feedback management
  only — no moderation cases are created.

## Public pages

`/mixed`, `/mixed/live`, `/mixed/matches`, `/mixed/matches/:matchId`,
`/mixed/maps`, `/mixed/maps/:mapKey`, `/mixed/players`, `/mixed/players/:uuid`,
`/mixed/leaderboards`, `/mixed/leaderboards/:category`, `/mixed/achievements`,
`/mixed/servers`, `/mixed/vote`, `/mixed/map-tokens`, `/mixed/store`.

## Admin pages (`zander.web.mixed`)

`/dashboard/mixed` (overview), `/dashboard/mixed/maps`,
`/dashboard/mixed/voting`, `/dashboard/mixed/ratings`,
`/dashboard/mixed/map-tokens`, `/dashboard/mixed/ranks`,
`/dashboard/mixed/entitlements`.

## Public / user API

`GET /api/mixed/live`, `/matches`, `/matches/:matchId`, `/maps`,
`/maps/:mapKey`, `/players`, `/players/:uuid`, `/leaderboards`,
`/leaderboards/:category`, `/achievements`, `/servers`, `/vote/current`,
`/votes/:voteId`, `/maps/:mapKey/ratings`, `/map-tokens`.
`POST /api/mixed/vote/cast`, `/maps/:mapKey/ratings`, `/map-tokens/request`,
`/store/checkout`.

## Admin API (`zander.web.mixed`)

`GET /api/admin/mixed/overview`, `PATCH /maps/:mapKey`,
`POST /maps/:mapKey/thumbnail`, `POST /votes/start`, `/votes/:id/end`,
`/votes/:id/cancel`, `PATCH /voting/settings`, `GET /ratings`,
`POST /ratings/:id/hide`, `/ratings/:id/remove`, `/maps/:mapKey/ratings/reset`,
`GET /map-tokens`, `POST /map-tokens/grant`, `/map-tokens/remove`,
`/map-requests/:id/refund`, `/map-requests/:id/cancel`, `/ranks/sync/:uuid`,
`GET/POST /entitlements/:uuid`, `DELETE /entitlements/:uuid/:entitlementId`,
`POST /maps/sync`, `POST /maps/sync/:sourceKey`, `GET /maps/sync/status`,
`GET /maps/sync/sources`, `GET /maps/sync/runs`, `GET /maps/sync/runs/:id/errors`.

## Mixed Map Repo Sync

Mixed map metadata is synced directly from GitHub repositories — **there is
no `maps.json` or manifest file**. Each configured repo follows this layout:

```
repo-name/
└─ maps/
   └─ <mapKey>/
      ├─ map.xml           ← sole source of truth for name/version/gamemode/authors/teams/objectives
      ├─ thumbnail.png     ← optional (png/jpg/jpeg/webp)
      └─ screenshots/      ← optional, any of png/jpg/jpeg/webp
```

The folder name under `maps/` becomes the map's stable `map_key` — it is
**never** derived from the display name in `map.xml`. A manifest file was
deliberately avoided since it would drift from the folder contents; the repo
itself (folder + `map.xml`) is the single source of truth.

### map.xml parsing

`lib/mixed/pgmMapXmlParser.js` extracts `name`, `version`, `objective`
(used as the description), `authors`, `contributors`, `teams`, `objectives`
and `rules`. It never throws — a malformed file is reported as a parse error
and the map is skipped, without aborting the rest of the sync. Gamemode is
inferred from module tags found anywhere in the document:

| Tag(s) | Gamemode |
|---|---|
| `wool` / `wools` | CTW |
| `flag` / `flags` | CTF |
| `core` / `cores` | DTC |
| `destroyable(s)` / `monument(s)` | DTM |
| `control-point(s)` / `hill(s)` | CP |
| `blitz` | Blitz |
| `score` | Score |

If nothing matches, `gamemode = "Unknown"` and `gamemodes = []`. The parser
disables entity/DTD processing and never fetches remote resources (it is not
vulnerable to XXE).

### Configuring repos (`config.json`)

```json
"mixed": {
  "mapSync": {
    "enabled": true,
    "provider": "github",
    "githubOrg": "CraftingForChrist",
    "githubTokenEnv": "MIXED_GITHUB_TOKEN",
    "duplicateMapKeyStrategy": "conflict",
    "assetUrlMode": "raw",
    "cronSchedule": "0 * * * *",
    "sources": [
      { "sourceKey": "primary", "displayName": "Primary Maps", "repo": "mixed-maps-primary", "branch": "main", "mapsPath": "maps", "enabled": true, "priority": 1 },
      { "sourceKey": "secondary", "displayName": "Secondary Maps", "repo": "mixed-maps-secondary", "branch": "main", "mapsPath": "maps", "enabled": true, "priority": 2 }
    ]
  }
}
```

All sources share one `githubOrg`, but each has its own `repo`/`branch`/
`mapsPath`. Add more sources to the array as needed — `branch` defaults to
`main`, `mapsPath` to `maps`, `enabled` to `true`, `priority` to `100`.

The GitHub token is read from `process.env[githubTokenEnv]` — it is optional
(public repos work without it) and is **never** logged or returned by any
API/admin response.

### Duplicate map keys

Controlled by `duplicateMapKeyStrategy`:

- `conflict` (default) — first source by priority wins; later duplicates are
  recorded as a `DUPLICATE_MAP_KEY` sync error and the existing map is
  flagged `last_sync_status = conflict` for admin review.
- `prefer_first` — same winner, but no conflict flag is set (a quieter skip).
- `prefer_latest` — the source with the most recent repo commit wins,
  regardless of priority order.
- `prefix_source_key` — later duplicates are kept under `sourceKey-mapKey`
  instead of being skipped (not the default).

### Admin overrides

`public_visible`, `custom_description`, `custom_thumbnail_url`, `custom_tags`,
`voting_enabled`, `token_enabled`, `blacklisted_from_voting` and
`blacklisted_from_tokens` are admin-controlled and are **never** overwritten
by a re-sync — only repo/XML-derived columns are updated. The public map
pages use a fallback chain: `custom_description || description_from_xml ||
"No description available."`, and similarly for the thumbnail and tags.

### Triggering a sync

- Manually: `POST /api/admin/mixed/maps/sync` (all repos) or
  `POST /api/admin/mixed/maps/sync/:sourceKey` (one repo), both from
  `/dashboard/mixed/maps`.
- Automatically: `cron/mixedMapSyncCron.js`, gated on
  `features.mixed && config.mixed.mapSync.enabled`, runs on
  `config.mixed.mapSync.cronSchedule` (default hourly).

### Placeholder maps

If `zander-pgm` reports a match for a `map_key` not yet known to any synced
repo, `upsertPlaceholderMap()` creates a minimal row
(`source_key = "server-discovered"`, `discovered_from_server = true`,
`voting_enabled = false`, `token_enabled = false`) so match ingestion never
fails. Once that map key appears in a synced repo, the next sync overwrites
it with full repo metadata.

### Troubleshooting

- **`INVALID_XML`** — the map's `map.xml` failed to parse or has no `<map>`
  root; check `GET /api/admin/mixed/maps/sync/runs/:id/errors` for the message.
- **`GITHUB_FETCH_FAILED`** — repo/branch not found, or GitHub rate-limited
  the request (unauthenticated requests are limited to 60/hour — set
  `githubTokenEnv` to raise this).
- **`DUPLICATE_MAP_KEY`** — resolve via the "Duplicate map key conflicts"
  panel on `/dashboard/mixed/maps`, or change `duplicateMapKeyStrategy`.
- A failed source or a single bad map never aborts the rest of the sync run.

## Security

- Plugin endpoints require a Bearer token; the token is server-side only.
- The Stripe webhook verifies the signature and is idempotent.
- Neither the plugin token nor the Stripe secret is exposed to the frontend.
- All player UUIDs are validated/normalised.
- Votes, ratings, token spends and purchases require a linked Minecraft account.
- Feedback is sanitised before public display.
- Admin endpoints require the `zander.web.mixed` capability.

## Database

Migration `prisma/migrations/0026_mixed_module` creates all `mixed_*` tables
plus `mixed_settings` and `mixed_stripe_webhook_events`. Migration
`prisma/migrations/0027_mixed_map_repo_sync` adds the repo-sync columns to
`mixed_maps` plus `mixed_map_sync_runs` and `mixed_map_sync_errors`. Run
migrations with:

```
npx prisma migrate deploy
```

## Live updates note

The repo does not bundle a WebSocket dependency, so live updates are delivered
over Server-Sent Events at `GET /api/mixed/stream` rather than a raw `/ws/mixed`
socket. The event names and payloads match the WebSocket contract in the spec,
so the frontend live views (`/mixed/live`, `/mixed/vote`) subscribe with
`EventSource`.
