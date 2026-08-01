# Rank → Discord Role Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a linked user's Discord roles in lockstep with their current LuckPerms ranks — granted on link/rejoin/rank-assign, revoked on rank-remove/unlink, and reconciled periodically to catch in-game LuckPerms changes.

**Architecture:** A single new module, `lib/discord/rankRoleSync.mjs`, exposes `syncMemberRankRoles(userId)` and `stripAllTrackedRankRoles(discordId)`. Both are called from existing link/unlink/rank-assignment code paths, plus a new `guildMemberAdd` hook and a new 15-minute cron job that mirrors `cron/badgeLuckpermsSyncCron.js`. Only Discord role IDs that appear as a rank's `discordRoleId` are ever added or removed — every other role a member holds is left untouched.

**Tech Stack:** Node.js (ESM), Sapphire/discord.js (`client` from `controllers/discordController.js`), raw `mysql2` queries against the primary DB and the LuckPerms DB (`luckpermsDb`), `node-cron`, Vitest for unit tests.

## Global Constraints

- Only ever add/remove Discord role IDs that are configured as some rank's `discordRoleId` (the "tracked role ID" set) — never touch unrelated roles a member holds.
- No feature flag beyond the existing `features.ranks` boolean — sync runs whenever `features.ranks` is `true`.
- All Discord API calls in the sync module must catch and log errors, never throw — this code runs inside link flows, dashboard API responses, and a cron loop, none of which may be broken by a Discord-side failure (missing role, missing permission, member not found).
- Follow the existing raw-SQL / callback-wrapped-in-Promise style already used in `controllers/userController.js`, `api/routes/ranks.js`, and the cron files — do not introduce Prisma models for this feature.
- Config is read via `config.discord.guildId` (already present in `config.json.example`), loaded with `createRequire` (this project is `"type": "module"`).

---

### Task 1: Pure role-diff helper + unit tests

**Files:**
- Create: `lib/discord/rankRoleSync.mjs`
- Test: `tests/unit/rankRoleSync.test.mjs`

**Interfaces:**
- Produces: `export function diffTrackedRoles(currentRoleIds, shouldHaveRoleIds, trackedRoleIds)` → `{ toAdd: string[], toRemove: string[] }`. All three params are arrays of role-ID strings (or `Set`s — implementation normalizes to `Set` internally). `toAdd` = role IDs in `shouldHaveRoleIds` but not in `currentRoleIds`. `toRemove` = role IDs in `currentRoleIds` that are in `trackedRoleIds` but not in `shouldHaveRoleIds`. Role IDs outside `trackedRoleIds` are never returned in either array, even if present in `currentRoleIds`.

This is the only pure, easily-unit-testable piece of the feature — everything else touches the Discord API or a live DB and is verified manually (see plan Task 8 and the design spec's Testing section).

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/unit/rankRoleSync.test.mjs
import { describe, it, expect } from "vitest";
import { diffTrackedRoles } from "../../lib/discord/rankRoleSync.mjs";

describe("diffTrackedRoles", () => {
  it("adds a role the member should have but doesn't", () => {
    const result = diffTrackedRoles([], ["role-a"], ["role-a", "role-b"]);
    expect(result).toEqual({ toAdd: ["role-a"], toRemove: [] });
  });

  it("removes a tracked role the member has but shouldn't", () => {
    const result = diffTrackedRoles(["role-a"], [], ["role-a", "role-b"]);
    expect(result).toEqual({ toAdd: [], toRemove: ["role-a"] });
  });

  it("never touches a role outside the tracked set, even if the member holds it", () => {
    const result = diffTrackedRoles(["untracked-role"], [], ["role-a"]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });

  it("never adds a role outside the tracked set", () => {
    const result = diffTrackedRoles([], ["untracked-role"], ["role-a"]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });

  it("is a no-op when current roles already match should-have roles", () => {
    const result = diffTrackedRoles(["role-a"], ["role-a"], ["role-a", "role-b"]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });

  it("handles multiple ranks worth of roles at once", () => {
    const result = diffTrackedRoles(
      ["role-a", "role-c"],
      ["role-a", "role-b"],
      ["role-a", "role-b", "role-c", "role-d"]
    );
    expect(result.toAdd).toEqual(["role-b"]);
    expect(result.toRemove).toEqual(["role-c"]);
  });

  it("deduplicates input arrays", () => {
    const result = diffTrackedRoles(["role-a", "role-a"], ["role-a"], ["role-a"]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/rankRoleSync.test.mjs`
Expected: FAIL — `diffTrackedRoles is not a function` / module has no export (file doesn't exist yet).

- [ ] **Step 3: Create the module with the pure helper**

```javascript
// lib/discord/rankRoleSync.mjs

/**
 * Diffs a member's current Discord roles against the roles they should have,
 * restricted to the set of role IDs that map to a rank (`trackedRoleIds`).
 * Role IDs outside that set are never touched, even if present in the inputs.
 */
export function diffTrackedRoles(currentRoleIds, shouldHaveRoleIds, trackedRoleIds) {
  const current = new Set(currentRoleIds);
  const shouldHave = new Set(shouldHaveRoleIds);
  const tracked = new Set(trackedRoleIds);

  const toAdd = [...shouldHave].filter((id) => tracked.has(id) && !current.has(id));
  const toRemove = [...current].filter((id) => tracked.has(id) && !shouldHave.has(id));

  return { toAdd, toRemove };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/rankRoleSync.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/discord/rankRoleSync.mjs tests/unit/rankRoleSync.test.mjs
git commit -m "feat: add pure role-diff helper for rank->Discord role sync"
```

---

### Task 2: DB query helpers for tracked roles and a user's rank roles

**Files:**
- Modify: `lib/discord/rankRoleSync.mjs`

**Interfaces:**
- Consumes: `db` (default export) and `luckpermsDb` (named export) from `controllers/databaseController.js` — both are `mysql2` pool instances with `.query(sql, params, callback)`.
- Produces:
  - `export async function getTrackedRoleIds()` → `string[]` — every distinct non-null `discordRoleId` across all ranks.
  - `export async function getUserRoleIdsByUuid(uuid)` → `string[]` — the `discordRoleId`s for every rank the given player `uuid` currently holds in LuckPerms.

Both query the same `ranks` / `userRanks` cross-database views already used in `api/routes/ranks.js` (`RANK_VIEW = "ranks"`, `USER_RANKS_VIEW = "userRanks"`), so no new views are needed.

- [ ] **Step 1: Add the query helpers**

```javascript
// Append to lib/discord/rankRoleSync.mjs

import db from "../../controllers/databaseController.js";

function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results || []);
    });
  });
}

/** Every distinct Discord role ID configured on any rank. */
export async function getTrackedRoleIds() {
  const rows = await queryDb(
    `SELECT DISTINCT discordRoleId FROM ranks WHERE discordRoleId IS NOT NULL AND discordRoleId != ''`
  );
  return rows.map((r) => String(r.discordRoleId));
}

/** Discord role IDs for every rank the given LuckPerms player uuid currently holds. */
export async function getUserRoleIdsByUuid(uuid) {
  if (!uuid) return [];
  const rows = await queryDb(
    `SELECT r.discordRoleId
       FROM userRanks ur
       JOIN ranks r ON ur.rankSlug = r.rankSlug
      WHERE ur.uuid = ? AND r.discordRoleId IS NOT NULL AND r.discordRoleId != ''`,
    [uuid]
  );
  return rows.map((r) => String(r.discordRoleId));
}
```

- [ ] **Step 2: Sanity-check against a running dev DB**

Run: `npm run dev`, then in a scratch Node REPL/script with the same env loaded:
```javascript
import { getTrackedRoleIds, getUserRoleIdsByUuid } from "./lib/discord/rankRoleSync.mjs";
console.log(await getTrackedRoleIds());
```
Expected: an array of role-ID strings matching whatever ranks currently have `discordRoleId` set in the LuckPerms DB (verify against the `/dashboard/ranks` page). If no ranks have `discordRoleId` set yet, expect `[]` — not an error.

- [ ] **Step 3: Commit**

```bash
git add lib/discord/rankRoleSync.mjs
git commit -m "feat: add tracked-role and per-user-role DB queries"
```

---

### Task 3: `syncMemberRankRoles` and `stripAllTrackedRankRoles`

**Files:**
- Modify: `lib/discord/rankRoleSync.mjs`

**Interfaces:**
- Consumes:
  - `diffTrackedRoles`, `getTrackedRoleIds`, `getUserRoleIdsByUuid` from Task 1/2 (same file).
  - `client` (named export) from `controllers/discordController.js`.
  - `config.discord.guildId` via `createRequire`.
  - `db` default export from `controllers/databaseController.js`, for a `userId → uuid`/`discordId` lookup.
- Produces:
  - `export async function syncMemberRankRoles(userId)` → `Promise<void>`. Looks up the user's `uuid` and `discordId`; no-ops if either is missing. Fetches the guild member; no-ops (logs) if not found. Computes should-have roles via `getUserRoleIdsByUuid`, current tracked roles via the member's role cache, tracked set via `getTrackedRoleIds`, diffs via `diffTrackedRoles`, and applies `member.roles.add`/`member.roles.remove` with the resulting arrays (skipping empty arrays — discord.js allows empty-array calls but skipping avoids a wasted API call). All errors caught and logged with a `[rankRoleSync]` prefix, never thrown.
  - `export async function stripAllTrackedRankRoles(discordId)` → `Promise<void>`. Fetches the guild member for the given `discordId` directly (no `userId` needed — used at unlink time, after the DB link may already be cleared). Removes every currently-held role that's in the tracked set. Same error handling.

- [ ] **Step 1: Implement `syncMemberRankRoles` and `stripAllTrackedRankRoles`**

```javascript
// Append to lib/discord/rankRoleSync.mjs

import { client } from "../../controllers/discordController.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const config = require("../../config.json");
const features = require("../../features.json");

async function fetchGuildMember(discordId) {
  const guildId = config.discord?.guildId;
  if (!guildId || !discordId) return null;

  const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return null;

  return guild.members.fetch(discordId).catch(() => null);
}

/**
 * Grants/revokes the given user's rank-mapped Discord roles so their
 * Discord roles match their current LuckPerms ranks. Never throws.
 */
export async function syncMemberRankRoles(userId) {
  if (!features.ranks || !userId) return;

  try {
    const [webUser] = await queryDb(
      `SELECT uuid, discordId FROM users WHERE userId = ? LIMIT 1`,
      [userId]
    );
    if (!webUser?.discordId) return;

    const member = await fetchGuildMember(webUser.discordId);
    if (!member) return;

    const [trackedRoleIds, shouldHaveRoleIds] = await Promise.all([
      getTrackedRoleIds(),
      getUserRoleIdsByUuid(webUser.uuid),
    ]);

    const currentRoleIds = [...member.roles.cache.keys()];
    const { toAdd, toRemove } = diffTrackedRoles(currentRoleIds, shouldHaveRoleIds, trackedRoleIds);

    if (toAdd.length) await member.roles.add(toAdd);
    if (toRemove.length) await member.roles.remove(toRemove);
  } catch (error) {
    console.error(`[rankRoleSync] Failed to sync roles for userId ${userId}:`, error.message);
  }
}

/**
 * Removes every tracked rank role from the given Discord user. Used when a
 * Discord account is unlinked, since we can no longer resolve their ranks.
 */
export async function stripAllTrackedRankRoles(discordId) {
  if (!features.ranks || !discordId) return;

  try {
    const member = await fetchGuildMember(discordId);
    if (!member) return;

    const trackedRoleIds = await getTrackedRoleIds();
    const currentRoleIds = [...member.roles.cache.keys()];
    const toRemove = currentRoleIds.filter((id) => trackedRoleIds.includes(id));

    if (toRemove.length) await member.roles.remove(toRemove);
  } catch (error) {
    console.error(`[rankRoleSync] Failed to strip roles for discordId ${discordId}:`, error.message);
  }
}
```

- [ ] **Step 2: Manual verification against the dev bot**

With `npm run dev` running and a test Discord account linked to a test rank that has `discordRoleId` set:
```javascript
import { syncMemberRankRoles } from "./lib/discord/rankRoleSync.mjs";
await syncMemberRankRoles(<test userId>);
```
Expected: the test Discord account gains the configured role in the guild within a few seconds. Removing the rank via `/dashboard/ranks` (or directly in LuckPerms) and re-running should remove the role.

- [ ] **Step 3: Commit**

```bash
git add lib/discord/rankRoleSync.mjs
git commit -m "feat: add syncMemberRankRoles and stripAllTrackedRankRoles"
```

---

### Task 4: Sync on web OAuth link and unlink

**Files:**
- Modify: `routes/profileRoutes.js:506` (link) and `routes/profileRoutes.js:571` (unlink)

**Interfaces:**
- Consumes: `syncMemberRankRoles(userId)` and `stripAllTrackedRankRoles(discordId)` from `lib/discord/rankRoleSync.mjs` (Task 3).

- [ ] **Step 1: Import the sync functions**

In `routes/profileRoutes.js`, near the existing `linkDiscordAccount`/`unlinkDiscordAccount` import:

```javascript
import { syncMemberRankRoles, stripAllTrackedRankRoles } from "../lib/discord/rankRoleSync.mjs";
```

- [ ] **Step 2: Call sync right after linking**

In the Discord OAuth callback handler, immediately after the existing:

```javascript
      await linkDiscordAccount(
        req.session.user.userId,
        discordUser.id,
        buildDiscordDisplayName(discordUser)
      );

      req.session.user.discordID = discordUser.id;
```

add:

```javascript
      await syncMemberRankRoles(req.session.user.userId);
```

- [ ] **Step 3: Call strip right before unlinking (need the discordId before it's cleared)**

Find the `/profile/social/discord/disconnect` handler:

```javascript
    try {
      await unlinkDiscordAccount(req.session.user.userId);
      req.session.user.discordID = null;
```

Change to capture the Discord ID first:

```javascript
    try {
      const discordIdBeingUnlinked = req.session.user.discordID;
      await unlinkDiscordAccount(req.session.user.userId);
      req.session.user.discordID = null;
      if (discordIdBeingUnlinked) {
        await stripAllTrackedRankRoles(discordIdBeingUnlinked);
      }
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, link a test account with a ranked role via the profile page → role appears in Discord. Disconnect Discord from the profile page → role is removed.

- [ ] **Step 5: Commit**

```bash
git add routes/profileRoutes.js
git commit -m "feat: sync rank roles on web account link/unlink"
```

---

### Task 5: Sync on `/forcelink` and its displaced-link cleanup

**Files:**
- Modify: `commands/forcelink.mjs`

**Interfaces:**
- Consumes: `syncMemberRankRoles(userId)` and `stripAllTrackedRankRoles(discordId)` from `lib/discord/rankRoleSync.mjs` (Task 3).

- [ ] **Step 1: Import the sync functions**

```javascript
import { syncMemberRankRoles, stripAllTrackedRankRoles } from "../lib/discord/rankRoleSync.mjs";
```

- [ ] **Step 2: Strip roles from a displaced Discord user**

The existing displacement block:

```javascript
    if (existingDiscordLink && existingDiscordLink.userId !== mcUser.userId) {
      warnings.push(
        `⚠️ <@${targetDiscordUser.id}> was previously linked to \`${existingDiscordLink.username}\` — that link will be cleared.`,
      );
      // Clear the old link from the Discord user's previous MC account
      await unlinkDiscordAccount(existingDiscordLink.userId);
    }
```

becomes:

```javascript
    if (existingDiscordLink && existingDiscordLink.userId !== mcUser.userId) {
      warnings.push(
        `⚠️ <@${targetDiscordUser.id}> was previously linked to \`${existingDiscordLink.username}\` — that link will be cleared.`,
      );
      // Clear the old link from the Discord user's previous MC account
      await unlinkDiscordAccount(existingDiscordLink.userId);
      await stripAllTrackedRankRoles(targetDiscordUser.id);
    }
```

- [ ] **Step 3: Sync roles for the newly force-linked account**

After the existing:

```javascript
    // Execute the force link
    const discordHandle = targetDiscordUser.username;
    await linkDiscordAccount(mcUser.userId, targetDiscordUser.id, discordHandle);
```

add:

```javascript
    await syncMemberRankRoles(mcUser.userId);
```

- [ ] **Step 4: Manual verification**

In a test Discord server, run `/forcelink` on a ranked test account → role is applied. Run `/forcelink` again to displace it onto a different Discord user → the original Discord user loses the tracked role, the new one gains it.

- [ ] **Step 5: Commit**

```bash
git add commands/forcelink.mjs
git commit -m "feat: sync rank roles on /forcelink and displaced-link cleanup"
```

---

### Task 6: Sync on rejoin (`guildMemberAdd`)

**Files:**
- Modify: `listeners/guildMemberAdd.js`

**Interfaces:**
- Consumes: `syncMemberRankRoles(userId)` from `lib/discord/rankRoleSync.mjs` (Task 3); `UserGetter` from `controllers/userController.js` (already used elsewhere, e.g. `listeners/guildMemberRemove.js`).

- [ ] **Step 1: Add the rank-role sync alongside the existing nickname check**

Current file:

```javascript
import { Listener } from "@sapphire/framework";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");
import { checkAndReportNickname } from "../lib/discord/nicknameCheck.mjs";

export class GuildMemberAddListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "guildMemberAdd",
    });
  }

  async run(member) {
    if (!features.discord?.events?.nicknameCheck) return;
    if (member.user.bot) return;

    const reportChannelId = config.discord?.nicknameReportChannelId;
    if (!reportChannelId) return;

    // Only enforce if they already have a linked account (e.g. re-joiners)
    await checkAndReportNickname(member, reportChannelId, "Member Joined");
  }
}
```

Replace with:

```javascript
import { Listener } from "@sapphire/framework";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");
import { checkAndReportNickname } from "../lib/discord/nicknameCheck.mjs";
import { syncMemberRankRoles } from "../lib/discord/rankRoleSync.mjs";
import { UserGetter } from "../controllers/userController.js";

export class GuildMemberAddListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: false,
      event: "guildMemberAdd",
    });
  }

  async run(member) {
    if (member.user.bot) return;

    // Re-apply rank roles for returning linked members — Discord doesn't
    // remember role state after a member leaves the server.
    const linkedAccount = await new UserGetter().byDiscordId(member.user.id);
    if (linkedAccount) {
      await syncMemberRankRoles(linkedAccount.userId);
    }

    if (!features.discord?.events?.nicknameCheck) return;

    const reportChannelId = config.discord?.nicknameReportChannelId;
    if (!reportChannelId) return;

    // Only enforce if they already have a linked account (e.g. re-joiners)
    await checkAndReportNickname(member, reportChannelId, "Member Joined");
  }
}
```

Note: the rank-role sync now runs independently of the `nicknameCheck` feature flag (it's gated by `features.ranks` inside `syncMemberRankRoles` itself), matching the design.

- [ ] **Step 2: Manual verification**

With a test account linked to a ranked role, leave the test Discord server, then rejoin. Expected: the tracked role is re-applied within a few seconds of rejoining (check bot logs for `[rankRoleSync]` errors if it doesn't appear).

- [ ] **Step 3: Commit**

```bash
git add listeners/guildMemberAdd.js
git commit -m "feat: re-sync rank roles when a linked member rejoins"
```

---

### Task 7: Sync on dashboard rank assign/remove

**Files:**
- Modify: `api/routes/ranks.js`

**Interfaces:**
- Consumes: `syncMemberRankRoles(userId)` from `lib/discord/rankRoleSync.mjs` (Task 3).
- Uses the existing `resolvePlayer(username)` helper in this file, which already returns `{ userId, username, uuid }` — `userId` may be `null` if the player has no web account, in which case sync is skipped (nothing to look up a `discordId` from).

- [ ] **Step 1: Import the sync function**

At the top of `api/routes/ranks.js`, alongside the existing imports:

```javascript
import { syncMemberRankRoles } from "../../lib/discord/rankRoleSync.mjs";
```

- [ ] **Step 2: Sync after a successful rank assignment**

In the `/api/rank/user/assign` handler, the success path currently ends with:

```javascript
      if (title) {
        await queryLuckPermsDb(
          `INSERT INTO ${LUCKPERMS_USER_PERMISSIONS_TABLE}
            (uuid, permission, value, server, world, expiry, contexts)
          VALUES (UNHEX(?), ?, 1, 'global', 'global', 0, '[]')`,
          [player.uuid, `meta.group.${rankSlug}.title.${title.substring(0, 64)}`]
        );
      }

      return res.send({
        success: true,
        message: "Rank assigned successfully.",
      });
```

Insert the sync call before the `return`:

```javascript
      if (title) {
        await queryLuckPermsDb(
          `INSERT INTO ${LUCKPERMS_USER_PERMISSIONS_TABLE}
            (uuid, permission, value, server, world, expiry, contexts)
          VALUES (UNHEX(?), ?, 1, 'global', 'global', 0, '[]')`,
          [player.uuid, `meta.group.${rankSlug}.title.${title.substring(0, 64)}`]
        );
      }

      if (player.userId) {
        await syncMemberRankRoles(player.userId);
      }

      return res.send({
        success: true,
        message: "Rank assigned successfully.",
      });
```

- [ ] **Step 3: Sync after a successful rank removal**

In the `/api/rank/user/remove` handler, currently:

```javascript
      const result = await queryLuckPermsDb(
        `DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = UNHEX(?) AND permission = ?`,
        [player.uuid, `group.${rankSlug}`]
      );

      await queryLuckPermsDb(
        `DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = UNHEX(?)
            AND permission LIKE CONCAT('meta.group.', ?, '.title.%')`,
        [player.uuid, rankSlug]
      );

      return res.send({
        success: true,
        message:
          result?.affectedRows > 0
            ? "Rank removed successfully."
            : "Rank was not assigned to the player.",
      });
```

Insert the sync call before the `return` (run it whenever a row was actually deleted):

```javascript
      const result = await queryLuckPermsDb(
        `DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = UNHEX(?) AND permission = ?`,
        [player.uuid, `group.${rankSlug}`]
      );

      await queryLuckPermsDb(
        `DELETE FROM ${LUCKPERMS_USER_PERMISSIONS_TABLE}
          WHERE uuid = UNHEX(?)
            AND permission LIKE CONCAT('meta.group.', ?, '.title.%')`,
        [player.uuid, rankSlug]
      );

      if (player.userId && result?.affectedRows > 0) {
        await syncMemberRankRoles(player.userId);
      }

      return res.send({
        success: true,
        message:
          result?.affectedRows > 0
            ? "Rank removed successfully."
            : "Rank was not assigned to the player.",
      });
```

- [ ] **Step 4: Manual verification**

Via the `/dashboard/ranks` UI (or a direct POST to `/api/rank/user/assign` with a valid session/permission), assign a ranked role to a linked test account → Discord role appears. Remove it → Discord role disappears.

- [ ] **Step 5: Commit**

```bash
git add api/routes/ranks.js
git commit -m "feat: sync rank roles on dashboard rank assign/remove"
```

---

### Task 8: Periodic reconciliation cron

**Files:**
- Create: `cron/rankDiscordRoleSyncCron.js`
- Modify: `app.js` (register the new cron import)

**Interfaces:**
- Consumes: `getTrackedRoleIds`, `diffTrackedRoles` from `lib/discord/rankRoleSync.mjs` (Tasks 1–2); `client` from `controllers/discordController.js`; `db` and `luckpermsDb` from `controllers/databaseController.js`.
- This cron does NOT call `syncMemberRankRoles` per-user (that would mean one Discord member-fetch per linked user every 15 minutes). Instead it batches: one query per tracked rank to find who currently holds it, one guild-wide member fetch, then an in-memory diff per member — matching the batching approach `badgeLuckpermsSyncCron.js` uses for badges.

- [ ] **Step 1: Write the cron module**

```javascript
// cron/rankDiscordRoleSyncCron.js
/**
 * cron/rankDiscordRoleSyncCron.js
 *
 * Periodically reconciles Discord roles against LuckPerms rank membership,
 * for every rank that has a discordRoleId configured. Catches rank changes
 * made directly via LuckPerms (in-game/console) that bypass the dashboard API.
 *
 * Logic:
 *  1. Load all ranks with a discordRoleId set.
 *  2. For each such rank, find the linked website users (discordId) who
 *     currently hold that LuckPerms group.
 *  3. Fetch the full guild member list once.
 *  4. For each guild member, diff their current tracked roles against the
 *     roles their linked ranks say they should have, and add/remove as needed.
 *
 * Runs every 15 minutes.
 */

import cron from "node-cron";
import { client } from "../controllers/discordController.js";
import db, { luckpermsDb } from "../controllers/databaseController.js";
import { diffTrackedRoles } from "../lib/discord/rankRoleSync.mjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

function queryDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function queryLuckPermsDb(sql, params = []) {
  return new Promise((resolve, reject) => {
    luckpermsDb.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function reconcileRankDiscordRoles() {
  if (!features.ranks) return;

  const guildId = config.discord?.guildId;
  if (!guildId) return;

  try {
    const ranks = await queryDb(
      `SELECT rankSlug, discordRoleId FROM ranks WHERE discordRoleId IS NOT NULL AND discordRoleId != ''`
    );
    if (ranks.length === 0) return;

    const trackedRoleIds = ranks.map((r) => String(r.discordRoleId));

    // Map: linked website userId -> Set of discordRoleIds they should have.
    const shouldHaveByUserId = new Map();

    for (const rank of ranks) {
      try {
        const lpRows = await queryLuckPermsDb(
          `SELECT LOWER(HEX(uuid)) AS uuid FROM luckperms_user_permissions
            WHERE permission = ? AND value = 1`,
          [`group.${rank.rankSlug}`]
        );
        if (lpRows.length === 0) continue;

        const uuids = lpRows.map((r) => r.uuid);
        const placeholders = uuids.map(() => "?").join(", ");
        const webUsers = await queryDb(
          `SELECT userId, discordId FROM users WHERE LOWER(uuid) IN (${placeholders}) AND discordId IS NOT NULL`,
          uuids
        );

        for (const user of webUsers) {
          if (!shouldHaveByUserId.has(user.userId)) {
            shouldHaveByUserId.set(user.userId, { discordId: user.discordId, roleIds: new Set() });
          }
          shouldHaveByUserId.get(user.userId).roleIds.add(String(rank.discordRoleId));
        }
      } catch (err) {
        console.error(`[rankRoleSync-cron] Error resolving members for rank ${rank.rankSlug}:`, err.message);
      }
    }

    const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      console.warn("[rankRoleSync-cron] Guild not found. Skipping.");
      return;
    }
    await guild.members.fetch();

    // Build discordId -> should-have role set for a fast lookup while sweeping all members.
    const shouldHaveByDiscordId = new Map();
    for (const { discordId, roleIds } of shouldHaveByUserId.values()) {
      shouldHaveByDiscordId.set(discordId, [...roleIds]);
    }

    let updated = 0;
    for (const [, member] of guild.members.cache) {
      const shouldHaveRoleIds = shouldHaveByDiscordId.get(member.id) || [];
      const currentRoleIds = [...member.roles.cache.keys()];
      const { toAdd, toRemove } = diffTrackedRoles(currentRoleIds, shouldHaveRoleIds, trackedRoleIds);

      if (toAdd.length === 0 && toRemove.length === 0) continue;

      try {
        if (toAdd.length) await member.roles.add(toAdd);
        if (toRemove.length) await member.roles.remove(toRemove);
        updated++;
      } catch (err) {
        console.error(`[rankRoleSync-cron] Failed to update roles for ${member.id}:`, err.message);
      }
    }

    console.log(`[rankRoleSync-cron] Reconciliation complete. ${updated} member(s) updated.`);
  } catch (err) {
    console.error("[rankRoleSync-cron] Fatal error during reconciliation:", err);
  }
}

// Run every 15 minutes
cron.schedule("*/15 * * * *", () => {
  reconcileRankDiscordRoles();
});

// Also run once on startup (after a short delay to let the DB pool and
// Discord client settle).
setTimeout(() => {
  reconcileRankDiscordRoles();
}, 15_000);

export { reconcileRankDiscordRoles };
```

- [ ] **Step 2: Register the cron in `app.js`**

In `app.js`, alongside the other cron imports (after line 57's `import("./cron/badgeLuckpermsSyncCron.js");`):

```javascript
import("./cron/rankDiscordRoleSyncCron.js");
```

- [ ] **Step 3: Manual verification**

Change a test account's rank directly via a LuckPerms console/game command (not through the dashboard). Either wait up to 15 minutes, or in a dev REPL:
```javascript
import { reconcileRankDiscordRoles } from "./cron/rankDiscordRoleSyncCron.js";
await reconcileRankDiscordRoles();
```
Expected: the test account's Discord role now matches its LuckPerms group, and console logs show `[rankRoleSync-cron] Reconciliation complete. N member(s) updated.`

- [ ] **Step 4: Commit**

```bash
git add cron/rankDiscordRoleSyncCron.js app.js
git commit -m "feat: add periodic rank->Discord role reconciliation cron"
```

---

### Task 9: Full-suite check and final review

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 7 new `rankRoleSync.test.mjs` tests, with no regressions in `tests/unit/permissions.test.mjs`, `tests/unit/mixedAuth.test.mjs`, etc.

- [ ] **Step 2: End-to-end manual walkthrough**

Using a test Discord account and a rank with `discordRoleId` configured:
1. Link via the website → role appears.
2. Leave the Discord server, rejoin → role re-appears.
3. Assign a second ranked role via `/dashboard/ranks` → both roles present.
4. Remove one rank via the dashboard → only the remaining rank's role is present.
5. Disconnect Discord from the profile page → both tracked roles removed.
6. Re-link, then run `/forcelink` to move the link to a different Discord user → original loses the role, new user gains it.
7. Confirm an unrelated, manually-assigned Discord role (not tied to any rank) is untouched throughout all of the above.

- [ ] **Step 3: Commit (if any fixups were needed)**

```bash
git add -A
git commit -m "fix: address issues found in end-to-end rank role sync walkthrough"
```
