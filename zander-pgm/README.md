# zander-pgm (ZanderPGM)

A [PGM](https://github.com/PGMDev/PGM) companion plugin for the
**Mixed** Minecraft server. ZanderPGM turns PGM match/objective/stat events into
internal DTOs and streams them to **zander-web** over REST (and optionally
WebSocket), and adds Map Tokens, Map Voting and post-match Map Ratings.

```
PGM events -> zander-pgm trackers -> internal DTOs -> zander-web API/WebSocket
```

> This repository contains the **Minecraft plugin only**. The web side is the
> separate **zander-web Mixed module** (public section `/mixed`).

## What "Mixed" is

Mixed is a PGM game mode / server run under the zander stack. ZanderPGM is the
in-game bridge that records what happens on Mixed and reports it to zander-web
for stats, profiles, leaderboards, maps, voting, ratings and store integration.

## What zander-pgm does

- Tracks the PGM **match lifecycle** (loaded / started / ended).
- Tracks **player stats** (kills, deaths, assists, first bloods, killstreaks).
- Tracks **big stats** where practical (damage, bow accuracy, blocks).
- Tracks **objective events** (wool, flag, core, destroyable, control point).
- Tracks **map stats** (times played, average duration, win rates).
- Awards **XP / levels** and unlocks **achievements**.
- Syncs **ranks / permission groups** (via LuckPerms) and generic **entitlements**.
- Supports **Map Tokens**, **Map Voting** and **post-match Map Ratings + feedback**.
- Emits **Discord hook** events to zander-web (zander-web decides what to post).

## Integration with PGM

PGM is a **required** dependency (`depend: [PGM]`). ZanderPGM integrates with PGM
**reflectively** — PGM event classes are resolved by name and registered through
a Bukkit `EventExecutor`, and match/map details are read via reflection. This
keeps the module compiling without the PGM artifact on the build classpath and
degrades gracefully across PGM versions: unknown events are simply skipped. Death
tracking additionally uses Bukkit's `PlayerDeathEvent` so it works regardless of
PGM's internal event names.

## Sending data to zander-web

All outbound calls run **off the main thread** (JDK `HttpClient`), use
`Authorization: Bearer <token>`, and include the server id, plugin version and a
timestamp. If zander-web is offline the plugin keeps running; failed events are
queued (bounded; oldest dropped when full) and retried, optionally in batches.

### Required dependencies

- **Paper** 1.21+ (`paper-api`)
- **PGM** (runtime, required)
- **LuckPerms** (optional; rank→permission syncing is disabled without it)
- Gson (shaded), JDK 17 `HttpClient`/`WebSocket`

## Config setup

Edit `config.yml` after first run. At minimum set:

```yaml
server:
  id: "mixed-1"
api:
  baseUrl: "https://zander-web.example.com"
  token: "<your token>"
```

Feature flags under `features:` toggle every subsystem; token/vote/rating
behaviour is tuned under `mapTokens:`, `mapVoting:` and `mapRatings:`.

## API endpoints expected in zander-web

```
POST /api/mixed/servers/heartbeat
POST /api/mixed/servers/offline
POST /api/mixed/events
POST /api/mixed/events/batch
POST /api/mixed/stats/player
POST /api/mixed/stats/match
POST /api/mixed/stats/map
POST /api/mixed/xp
POST /api/mixed/achievements
POST /api/mixed/ranks/sync
GET  /api/mixed/ranks/player/{uuid}
POST /api/mixed/entitlements/sync
GET  /api/mixed/map-token-requests/pending
POST /api/mixed/map-token-requests/:id/result
GET  /api/mixed/vote/current
POST /api/mixed/vote/cast
POST /api/mixed/maps/:mapKey/ratings
```

WebSocket: `wss://.../ws/mixed`. Outbound: SERVER_ONLINE, HEARTBEAT, MATCH_*,
PLAYER_DEATH, OBJECTIVE_EVENT, LIVE_FEED_EVENT, MAP_VOTE_*, MAP_RATING_*,
MAP_REQUEST_*. Inbound: PING, REQUEST_STATUS, REQUEST_STATS_FLUSH,
REQUEST_RANK_SYNC, REQUEST_ENTITLEMENT_SYNC, MAP_TOKEN_REQUEST, START_MAP_VOTE,
CANCEL_MAP_VOTE, FORCE_END_MAP_VOTE. (Remote console commands are **not**
implemented in this initial version.)

## Commands

| Command | Description |
| --- | --- |
| `/zpgm <status\|reload\|reconnect\|flush\|debug>` | Admin ops |
| `/zpgm vote <start\|end\|status\|cancel>` | Manage the current vote |
| `/zpgm maptokens <status\|clear>` | Map token status / clear override |
| `/zpgm rating reset <map>` | Reset the current rating session |
| `/vote <number>` | Cast an in-game map vote |
| `/mapvote` | View the current vote and tally |
| `/maprate <1-5> [feedback]` | Rate the last map |
| `/mapfeedback <feedback>` | Add feedback to your rating |
| `/maprating` | View the current rating prompt |

## Permissions

`zanderpgm.admin` (op), `zanderpgm.vote`, `zanderpgm.rate`, `zanderpgm.stats`,
`zanderpgm.profile`, `zanderpgm.rank.admin`.

## How Map Tokens work

Players buy/earn tokens on zander-web and spend them to influence map selection:
nominate a map into the next vote (1), set the next match (3), or sponsor a
featured vote option (5). zander-pgm polls zander-web for pending requests,
validates them (map exists, enabled, not blacklisted, cooldowns, minimum
players), and applies valid ones to the **next** match/vote — never interrupting
a running match. Failures are reported back so zander-web can refund tokens when
`refundIfFailed` is set. Lifecycle events: `MAP_REQUEST_RECEIVED / ACCEPTED /
APPLIED / REJECTED / FAILED / REFUNDED`.

## How Map Voting works

Before the next match a vote is created (default 4 options, 45s window, one vote
per player, changeable while active). Options come from rotation/random/featured
maps plus token nominations/sponsorships (sponsored maps get a boost weight).
The winner becomes the next map. Web voting is handled by zander-web (login +
linked Minecraft account). Admins can start/end/cancel votes. Votes apply to the
next match only.

## How Map Ratings and feedback work

When a match ends, participants are prompted to rate the map 1–5 (configurable
window, default 180s). One rating per player per match, updatable during the
window. Optional feedback (max 300 chars) is stored in zander-web for
admin review and optional public display. Only players who played the match may
rate it.

## How rank sync works

On join, the player's rank is fetched from
`GET /api/mixed/ranks/player/{uuid}` and the primary group is applied through
LuckPerms (if present). Only the group / permission nodes are managed — never
chat prefixes, suffixes, tags or formatting.

## How entitlements work

Generic, non-chat entitlement flags (cosmetic access, supporter perks, map vote
weight, reserved slot, web-only profile badges) are tracked per player and
synced to zander-web. Chat tags/formatting are never modelled.

## Building

This module is part of the `zander` Maven reactor and builds with Java 17.
`paper-api` is resolved from `https://repo.papermc.io`; the build needs network
access to that repository. From the repo root:

```
mvn -pl zander-pgm -am package
```

The shaded jar lands in `zander-pgm/target/` (and the aggregated
`target/plugins/` directory).

## Manual test checklist

1. Start server with PGM and zander-pgm.
2. Confirm startup detects PGM.
3. Confirm heartbeat reaches zander-web.
4. Load a PGM map — confirm `MATCH_LOADED` is sent.
5. Start match — confirm `MATCH_STARTED`.
6. Kill a player — confirm `PLAYER_DEATH`.
7. Complete an objective — confirm `OBJECTIVE_EVENT`.
8. Finish match — confirm `MATCH_ENDED` + stats snapshots.
9. Confirm players receive the `/maprate` prompt; submit `/maprate 5` and
   `/maprate 4 optional feedback`; confirm the rating event is sent.
10. Start a vote, `/vote <number>`, confirm the vote event and that the winner
    becomes the next map.
11. Receive a Map Token request from zander-web; confirm validation, apply/reject
    and result reporting.
12. Stop zander-web — confirm events queue instead of crashing. Restart it —
    confirm the queue flushes.
