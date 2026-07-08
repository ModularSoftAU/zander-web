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
header equal to `MIXED_PLUGIN_API_TOKEN`. The token is never exposed to the
browser.

```
Authorization: Bearer <MIXED_PLUGIN_API_TOKEN>
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

1. Generate a long random string and set `MIXED_PLUGIN_API_TOKEN` in `.env`.
2. Configure zander-pgm to send it as a Bearer token on every ingestion call.

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
`GET/POST /entitlements/:uuid`, `DELETE /entitlements/:uuid/:entitlementId`.

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
plus `mixed_settings` and `mixed_stripe_webhook_events`. Run migrations with:

```
npx prisma migrate deploy
```

## Live updates note

The repo does not bundle a WebSocket dependency, so live updates are delivered
over Server-Sent Events at `GET /api/mixed/stream` rather than a raw `/ws/mixed`
socket. The event names and payloads match the WebSocket contract in the spec,
so the frontend live views (`/mixed/live`, `/mixed/vote`) subscribe with
`EventSource`.
