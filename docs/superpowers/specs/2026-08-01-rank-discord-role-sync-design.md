# Rank → Discord Role Sync

## Problem

Ranks (LuckPerms groups) already carry an optional `discordRoleId` (`meta.discordid`,
surfaced via the `ranks` DB view and editable in the ranks dashboard), but nothing in
the app ever applies that role to a member's actual Discord roles. Today a linked
user's Discord roles are never granted, and they drift further out of sync on rejoin
or when their rank changes.

## Goal

Keep a linked user's Discord roles in lockstep with their current LuckPerms ranks,
for every rank that has a `discordRoleId` configured:

- Grant the mapped role(s) when a user links their Discord account.
- Re-grant on rejoin (Discord doesn't remember role state after a member leaves).
- Grant/revoke immediately when ranks are assigned/removed via the dashboard API.
- Revoke rank roles when a user's Discord account is unlinked.
- Periodically reconcile (every 15 min) to catch rank changes made directly via
  LuckPerms in-game/console, outside this app — mirrors the existing
  `cron/badgeLuckpermsSyncCron.js` pattern for badges.

Only roles that map to a tracked rank (`discordRoleId` set on some rank) are ever
touched. Unrelated roles a member holds are never added or removed.

## Non-goals

- No feature flag — this always runs whenever `features.ranks` is enabled and a rank
  has a `discordRoleId` set (matches how `discordRoleId` is already surfaced/edited
  unconditionally under the `ranks` feature).
- No change to how ranks are stored (still LuckPerms groups/permissions).
- No UI changes — `discordRoleId` config already exists in the ranks dashboard.

## Design

### Core sync module — `lib/discord/rankRoleSync.mjs`

```
export async function syncMemberRankRoles(userId)
```
- Loads the user's `discordId` (via `UserGetter`/raw query) and their current ranks
  joined against the `ranks` view (same query shape as `api/routes/ranks.js`
  `/user` endpoint) to get the set of `discordRoleId`s they should hold.
- Loads the full set of *tracked* role IDs (every non-null `discordRoleId` across
  all ranks) — this is the "roles we're allowed to touch" boundary.
- No `discordId` → no-op.
- Fetches the guild (`config.discord.guildId`) and member via the shared
  `client` from `controllers/discordController.js`. Member not in guild → no-op
  (nothing to sync until they rejoin, handled by the `guildMemberAdd` trigger).
- Diffs member's current roles ∩ tracked-role-ID set against the should-have set:
  adds missing roles, removes extra ones, via `member.roles.add`/`.remove`
  (batched arrays, not one call per role).
- All Discord API errors (missing role, missing permissions, hierarchy issues) are
  caught and `console.error`'d — this function must never throw into a link flow,
  a dashboard API response, or a cron loop.

```
export async function stripAllTrackedRankRoles(discordId)
```
- Fetches the member, removes every tracked role ID they currently hold (used on
  unlink, where we no longer have a `userId` → rank link to check against).
- Same error-swallowing behavior.

Both functions independently query the `ranks` view for the current tracked-role-ID
set (no caching) — call volume is low (link/rejoin/dashboard actions + one cron
tick per 15 min), so simplicity wins over caching.

### Trigger points

1. **Web OAuth link** — `routes/profileRoutes.js`, right after the existing
   `await linkDiscordAccount(...)` call (~line 506): `await syncMemberRankRoles(req.session.user.userId)`.
2. **`/forcelink`** — `commands/forcelink.mjs`, right after
   `await linkDiscordAccount(mcUser.userId, ...)` (~line 104).
3. **Rejoin** — `listeners/guildMemberAdd.js`: look up `UserGetter.byDiscordId(member.user.id)`;
   if linked, `await syncMemberRankRoles(linked.userId)`. Runs alongside the existing
   nickname-check logic, independent of the `nicknameCheck` feature flag.
4. **Dashboard rank assign/remove** — `api/routes/ranks.js`, in
   `/api/rank/user/assign` and `/api/rank/user/remove`, after the LuckPerms rows are
   written: resolve the player's linked `userId` (already have `uuid`/`username` via
   `resolvePlayer`; look up `users` table by `uuid`) and call `syncMemberRankRoles`.
5. **Unlink** — `routes/profileRoutes.js` `/profile/social/discord/disconnect`
   and `commands/forcelink.mjs`'s displaced-link handling (when an existing Discord
   link is cleared via force-relink): call `stripAllTrackedRankRoles(discordId)`
   using the `discordId` captured *before* it's nulled out.

### Periodic reconciliation — `cron/rankDiscordRoleSyncCron.js`

Mirrors `badgeLuckpermsSyncCron.js`'s structure and schedule (`*/15 * * * *`,
plus a 10s-delayed startup run):

1. Load all ranks with a non-null `discordRoleId`.
2. For each such rank: query `luckperms_user_permissions` for UUIDs holding
   `group.<rankSlug>` = 1, map to linked website `userId`/`discordId` (join `users`
   on `uuid`), and grant the role to each corresponding guild member who doesn't
   have it yet.
3. Sweep: for each tracked role, iterate guild members currently holding that role
   (via `guild.members.cache`/`fetch`) and remove it from any member whose linked
   account is no longer in that rank's LP group (or isn't linked at all).
4. Same per-item try/catch-and-log as the badge cron — one bad row must not abort
   the whole run.

## Testing

- Manual: link a test account with a rank that has `discordRoleId` set → role
  appears immediately.
- Manual: leave and rejoin the test Discord server → role re-applied via
  `guildMemberAdd`.
- Manual: assign/remove a rank via the dashboard → role added/removed immediately.
- Manual: disconnect Discord from profile → tracked role removed.
- Manual: change a rank directly via a LuckPerms console command (bypassing the
  app) → confirm the role appears/disappears within one cron cycle (or trigger the
  cron function directly in a REPL/test script rather than waiting 15 min).
- No existing automated test suite covers Discord role mutation; given the app's
  raw-SQL/live-service architecture, this stays manual (matches how
  `badgeLuckpermsSyncCron.js` and the nickname-check flow are verified today).
