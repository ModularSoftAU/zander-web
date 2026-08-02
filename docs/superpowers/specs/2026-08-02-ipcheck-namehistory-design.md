# `/ipcheck` and `/namehistory`/`/nh` Discord Commands — Design

## Summary

Add two Discord-only slash command features to the existing Sapphire bot in this repo:

1. **`/ipcheck`** — staff-only lookup of a player's recorded IP addresses (and other accounts sharing those IPs), backed by a new aggregate table fed from the existing session-ingestion endpoint.
2. **`/namehistory`** / **`/nh`** — public lookup of a Minecraft player's current/previous usernames via NameMC, with caching, rate-limiting, and graceful degradation.

Neither feature touches Minecraft/Velocity/Paper/Bukkit — no proxy or plugin source exists in this repo, and none is added. If the upstream game server's IP-capture code needs correcting (the spec's Java snippet), that is out of scope here since that code lives in a separate repository.

## Context from existing codebase

- Commands live in `commands/*.mjs`, extend Sapphire's `Command`, register via `registerApplicationCommands(registry)` with `SlashCommandBuilder`, and implement `chatInputRun(interaction)`. See `commands/lpaudit.mjs` and `commands/punish.mjs` for the reference pattern (defer ephemeral reply first, permission gate via linked account, `EmbedBuilder` responses, pagination via `ActionRowBuilder`/`ButtonBuilder` + `createMessageComponentCollector`).
- Staff permission checks use a LuckPerms-style permission-node system: `UserGetter().byDiscordId(interaction.user.id)` → `getUserPermissions(linkedAccount)` → `hasPermission(userPermissions, NODE)` from `lib/discord/permissions.mjs`. This repo does **not** gate Discord commands by raw Discord role ID; permission nodes are the existing convention and are used here instead of the spec's role-ID config.
- `gameSessions` (`prisma/schema.prisma`) already stores `userId`, `ipAddress`, `server`, `sessionStart`/`sessionEnd` per session, populated by `api/routes/session.js`'s `POST /api/session/create`, which the game server already calls. There is currently no aggregate (per-IP first/last-seen, session count) table — `/ipcheck` needs one.
- `features.json` holds boolean feature toggles (nested by key), loaded via `createRequire` + `require("../features.json")`. `config.json` (gitignored, `config.json.example` checked in) holds operational config like permission node strings and channel IDs, loaded the same way.
- No existing NameMC integration or third-party-HTTP caching pattern exists in the codebase. `/namehistory` introduces this as new, isolated code.

## Feature 1: `/ipcheck`

### Data model

New Prisma migration adding `player_ip_history`:

| column | type | notes |
|---|---|---|
| `id` | int, PK, autoincrement | |
| `uuid` | varchar, indexed | Minecraft UUID (dashed form, matching `users.uuid`) |
| `ip_address` | varchar(45), indexed | normalized (no port, no leading `/`, canonical IPv4/IPv6 text form) |
| `first_seen_at` | datetime | |
| `last_seen_at` | datetime | |
| `session_count` | int, default 0 | |
| `created_at` | datetime, default now | |
| `updated_at` | datetime, auto-update | |

Unique constraint on `(uuid, ip_address)`.

### Population

`POST /api/session/create` (`api/routes/session.js`) already receives `uuid` and `ipAddress` on every session start. After the existing `gameSessions` insert, add an upsert into `player_ip_history`:

```sql
INSERT INTO player_ip_history (uuid, ip_address, first_seen_at, last_seen_at, session_count)
VALUES (?, ?, NOW(), NOW(), 1)
ON DUPLICATE KEY UPDATE last_seen_at = NOW(), session_count = session_count + 1
```

Because this upsert lives at the same request/idempotency point as the existing session-create call, a retried request naturally does not double-count beyond whatever the existing `gameSessions` retry behavior already tolerates — no separate dedup mechanism is introduced. IP normalization (strip `/` prefix and port, canonical IPv4/IPv6 text form, no reverse DNS) happens before this insert, reusing the same normalization function the `/ipcheck ip` search input uses.

### Command

`commands/ipcheck.mjs`, following the `lpaudit.mjs`/`punish.mjs` pattern:

- `.addSubcommand` for `username` (option: `username`, string, required) and `ip` (option: `address`, string, required).
- `deferReply({ ephemeral: true })` first; every response in this command is ephemeral.
- Require a linked account (`UserGetter().byDiscordId`) and permission node `zander.discord.ipcheck` (configurable name, default this) via `hasPermission`. On failure, respond with the exact generic denial message from the spec; do not reveal whether the target exists.
- **`username` subcommand**: resolve the username to a `uuid` via the existing `users` table (not NameMC — internal-only data per requirement), fetch current status (online/offline, current server — reuse whatever session/status lookup `punish.mjs`'s history handler already uses), fetch all `player_ip_history` rows for that uuid, and for each IP, reverse-lookup other uuids that share it (with their last-seen date). Build the embed per the spec's example format.
- **`ip` subcommand**: normalize and validate the input address (reject malformed input before querying), fetch all `player_ip_history` rows for that exact address, join to current username/status per uuid.
- Always append the shared-IP disclaimer footer.
- Pagination: 8 records per page (configurable), Previous/Next `ButtonBuilder`s, `createMessageComponentCollector` filtered to the invoking user's id, buttons disabled when the collector ends or on timeout, page indicator in the embed footer/title.

### Audit trail

New table `ip_check_audit_log` (Prisma migration, same batch as `player_ip_history`):

| column | notes |
|---|---|
| `id` | PK |
| `discord_user_id`, `discord_tag` | |
| `permission_node_matched` | |
| `query_type` | `USERNAME` \| `IP` |
| `search_target` | full value, stored for audit purposes only |
| `result_count` | |
| `success` | boolean |
| `guild_id`, `channel_id` | |
| `created_at` | |

On every `/ipcheck` invocation (success or failure), insert one row, then post a sanitized embed to a configured audit channel (`config.discord.ipcheck.auditChannelId`) with the IP masked (`203.0.113.xxx`) — mirroring `punish.mjs`'s `sendLogEmbed` pattern. The unmasked target stays in the DB row only.

### Config additions

`config.json.example`:
```json
"discord": {
  "ipcheck": {
    "permissionNode": "zander.discord.ipcheck",
    "auditChannelId": "",
    "pageSize": 8
  }
}
```
`features.json`: `discord.ipcheck` boolean toggle, checked at the top of `chatInputRun` (mirrors existing `features?.discord?...` guard style).

### Logging rules

Never log: full IP addresses, full query results, tokens/keys. Safe to log: command name, discord user id, success/fail, duration, masked IP, cache/permission outcomes.

## Feature 2: `/namehistory` / `/nh`

### Service

New file `lib/discord/nameMcLookup.mjs`, exporting a single `lookupNameHistory(username)`:

- Validates `^[A-Za-z0-9_]{3,16}$` before any network call; rejects synchronously otherwise.
- Fetches from NameMC (structured JSON endpoint first if available; otherwise fetches the public profile page and parses with `cheerio`, never regex-scraping HTML).
- Returns a discriminated result: `{ status: "found", currentName, uuid, previousNames: [{name, changedAt}], profileUrl, avatarUrl }`, `{ status: "not_found" }`, or `{ status: "unavailable" }` (timeout, non-2xx excluding 404, parse failure, or exhausted rate limit).
- All NameMC-specific request/parsing logic stays inside this file — command code only calls `lookupNameHistory`.

### Caching, rate limiting, dedup

All in-memory (no Redis in this stack), scoped to the bot process:

- Result cache: `Map<username_lowercased, {result, expiresAt}>`, TTL from `cacheDurationMinutes` (default 60).
- In-flight dedup: `Map<username_lowercased, Promise>` — concurrent lookups for the same name await the same in-flight promise instead of firing duplicate requests.
- Outbound rate limiter: a simple token bucket/minimum-interval gate shared across all NameMC calls; on HTTP 429, back off and surface `unavailable` rather than retrying immediately.
- Per-Discord-user cooldown: `Map<discordUserId, lastUsedAt>`, default 10s (`cooldownSeconds`), admins exempt from this only — never from the global rate limiter.

### Command

`commands/namehistory.mjs` registers both `/namehistory` and `/nh` (two `SlashCommandBuilder`s, shared handler function).

- Validates the username locally; on failure, ephemeral error, no NameMC call.
- Checks per-user cooldown (ephemeral message if on cooldown, unless admin) and the configured allowed-channel list (empty list = any channel in the guild).
- Calls `lookupNameHistory`; maps `not_found`/`unavailable`/`found` to the exact response text specified (including "No previous usernames were found..." vs a hard not-found vs unavailable message — these are distinct and must not be conflated).
- On success, replies **non-ephemeral** by default (`publicResults` config, default `true`); embed includes current name, UUID, previous names with change dates, NameMC profile link, avatar, retrieval timestamp, and an "Identity: Mojang · History: NameMC" footer.
- All NameMC-sourced text (usernames) is sanitized against `@everyone`/`@here`/role/user mentions and markdown injection before being placed in the embed (small shared sanitize helper, reusable by both features).

### Config additions

`config.json.example`:
```json
"discord": {
  "namehistory": {
    "allowedChannelIds": [],
    "cooldownSeconds": 10,
    "cacheDurationMinutes": 60,
    "requestTimeoutSeconds": 10,
    "publicResults": true
  }
}
```
`features.json`: `discord.namehistory` boolean toggle.

## Testing plan (Vitest, `tests/unit/` + `tests/integration/`)

- IP normalization: IPv4, IPv6, IPv4-mapped IPv6, leading `/` and port stripped, malformed input rejected.
- `/ipcheck` permission gate: denied without permission node, allowed with it; generic denial message, no data leak.
- `/ipcheck` responses always ephemeral (assert `deferReply` called with `ephemeral: true`).
- Username search returns all stored IPs for a uuid; IP search returns all uuids for an address; shared-IP warning present in all results.
- Pagination buttons scoped to the invoking user; expired/ended collectors disable buttons.
- Audit row created on every invocation (success and failure), masked IP in the posted embed, full value only in DB.
- No full IP address appears in any `console.log`/logger call made by the command path (grep-style assertion over captured log output in tests).
- `nameMcLookup` parsing: found with multiple previous names, found with none, not-found, timeout → `unavailable`, 429 → `unavailable`/backoff.
- Cache hit avoids a second fetch; concurrent identical lookups are deduplicated to one in-flight request.
- Mention/markdown sanitization strips `@everyone`, `@here`, role/user mention syntax from NameMC-sourced text.
- `/nh` produces the same result shape as `/namehistory` for the same input (can share a handler-level test).
- No Minecraft-side command registration exists for either feature (repo-wide search assertion, since none exists to register in the first place).

## Out of scope

- Any change to the Minecraft-side game server/plugin/proxy — no such source exists in this repo.
- Reverse DNS lookups of any kind.
- Bypassing NameMC's CAPTCHA/Cloudflare protections or using browser automation.
- Redis or any external cache/queue — in-memory is sufficient for a single bot process at current scale.
