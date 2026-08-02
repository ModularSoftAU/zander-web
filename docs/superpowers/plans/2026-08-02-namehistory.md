# /namehistory and /nh Discord Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public `/namehistory` and `/nh` Discord slash commands that look up a Minecraft player's current/previous usernames via NameMC, with caching, rate limiting, cooldowns, and graceful degradation when NameMC is unavailable.

**Architecture:** An isolated `lib/discord/nameMcLookup.mjs` service owns all NameMC HTTP calls and HTML parsing (via `cheerio`), wrapped by `lib/discord/nameMcCache.mjs` (in-memory TTL cache, in-flight dedup, and a global rate limiter). `lib/discord/nameHistoryFormat.mjs` builds embed data and enforces per-user cooldowns. `commands/namehistory.mjs` registers both `/namehistory` and `/nh` against one shared handler.

**Tech Stack:** Node.js (ESM), Sapphire (`@sapphire/framework`), discord.js, `node-fetch` (already a dependency), `cheerio` (new dependency), Vitest.

## Global Constraints

- Validate usernames against `^[A-Za-z0-9_]{3,16}$` before any network call; reject locally otherwise.
- **Data source split (revised from the original single-source design):** current username, UUID, and avatar come from Mojang's official API (`api.mojang.com/users/profiles/minecraft/{username}` for the UUID/current-name, [Crafatar](https://crafatar.com) for the avatar image URL — a stable public URL keyed by UUID, no fetch needed). NameMC is queried **only** for the previous-names list (by UUID, not username — usernames change, UUIDs don't), since Mojang no longer publishes name-change history (that endpoint was removed in 2022). Do not add the third-party `namemc` npm package or any other unofficial NameMC wrapper as a dependency — keep our own minimal `cheerio`-based parser, scoped to just the previous-names section, per the "do not treat third-party unofficial NameMC wrappers as guaranteed stable dependencies" requirement.
- Never attempt to bypass CAPTCHA/Cloudflare, never use browser automation, never perform reverse DNS (not applicable here but stated for clarity — no IP handling in this feature at all).
- Distinguish exactly three outcomes with distinct copy: not-found profile (Mojang has no such username), found-with-no-previous-names, and unavailable (timeout/5xx/429/parse failure from either Mojang or NameMC) — never conflate "unavailable" with "no history". If Mojang resolves the username successfully but the NameMC previous-names step fails/times out, the overall result is `unavailable` (not a silent "no history"), since we cannot distinguish "genuinely no history" from "couldn't check" in that case.
- Validation errors, cooldown messages, and internal errors are ephemeral; successful lookups are public by default (`publicResults` config, default `true`).
- All NameMC-sourced text must be sanitized against `@everyone`/`@here`/role/user mentions and markdown injection before it reaches a Discord embed.
- Cache and rate-limit state is in-memory (no Redis in this stack) — acceptable since the bot runs as a single process.
- Follow existing patterns: `createRequire` for `config.json`/`features.json`, `node-fetch` for HTTP (not global `fetch`).

---

### Task 1: Add cheerio dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run: `npm install cheerio`
Expected: `package.json` and `package-lock.json` gain a `cheerio` entry (dependencies, not devDependencies — used at runtime).

- [ ] **Step 2: Verify import works**

Run: `node -e "const cheerio = require('cheerio'); console.log(typeof cheerio.load)"`
Expected: prints `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cheerio for NameMC HTML parsing"
```

---

### Task 2: Mention/markdown sanitizer

**Files:**
- Create: `lib/discord/textSanitize.mjs`
- Test: `tests/unit/textSanitize.test.mjs`

**Interfaces:**
- Produces: `sanitizeExternalText(text: string): string` — neutralizes `@everyone`, `@here`, `<@id>`, `<@&id>`, `<#id>` mention syntax (by inserting a zero-width space after `@`/`<`) and escapes markdown special characters (`*`, `_`, `` ` ``, `~`, `|`) that could alter embed rendering. Safe to call on any untrusted string before embedding it.

- [ ] **Step 1: Write failing tests**

```js
// tests/unit/textSanitize.test.mjs
import { describe, it, expect } from "vitest";
import { sanitizeExternalText } from "../../lib/discord/textSanitize.mjs";

describe("sanitizeExternalText", () => {
  it("neutralizes @everyone", () => {
    expect(sanitizeExternalText("@everyone")).not.toContain("@everyone");
  });

  it("neutralizes @here", () => {
    expect(sanitizeExternalText("@here")).not.toContain("@here");
  });

  it("neutralizes a user mention", () => {
    const result = sanitizeExternalText("<@123456789>");
    expect(result).not.toMatch(/^<@\d+>$/);
  });

  it("neutralizes a role mention", () => {
    const result = sanitizeExternalText("<@&123456789>");
    expect(result).not.toMatch(/^<@&\d+>$/);
  });

  it("escapes markdown special characters", () => {
    expect(sanitizeExternalText("*bold* _italic_ `code`")).toBe("\\*bold\\* \\_italic\\_ \\`code\\`");
  });

  it("leaves a plain Minecraft username untouched aside from no-op escaping", () => {
    expect(sanitizeExternalText("ExamplePlayer")).toBe("ExamplePlayer");
  });
});
```

Run: `npx vitest run tests/unit/textSanitize.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

```js
// lib/discord/textSanitize.mjs
export function sanitizeExternalText(text) {
  if (typeof text !== "string") return "";

  let result = text;

  // Break mention syntax by inserting a zero-width space after '@' or '<'.
  result = result.replace(/@(everyone|here)/gi, "@​$1");
  result = result.replace(/<(@[!&]?\d+|#\d+)>/g, "<​$1>");

  // Escape markdown special characters so external text can't alter embed formatting.
  result = result.replace(/([*_`~|])/g, "\\$1");

  return result;
}
```

- [ ] **Step 3: Run tests and verify pass**

Run: `npx vitest run tests/unit/textSanitize.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/discord/textSanitize.mjs tests/unit/textSanitize.test.mjs
git commit -m "feat: add mention/markdown sanitizer for external text"
```

---

### Task 3: In-memory cache, dedup, and rate limiter

**Files:**
- Create: `lib/discord/nameMcCache.mjs`
- Test: `tests/unit/nameMcCache.test.mjs`

**Interfaces:**
- Produces a factory `createNameMcCache({ cacheTtlMs, minIntervalMs })` returning:
  - `getCached(username: string): any | undefined` — returns a cached result if present and not expired (keyed on lowercased username).
  - `setCached(username: string, value: any): void`
  - `dedupe(username: string, fn: () => Promise<any>): Promise<any>` — if a lookup for this username is already in flight, returns the same promise instead of calling `fn` again.
  - `throttle(fn: () => Promise<any>): Promise<any>` — enforces a minimum interval (`minIntervalMs`) between the start of any two calls made through this limiter, queuing calls that arrive too soon.

  A factory (not a singleton module) is used so tests can construct isolated instances with short TTLs/intervals instead of waiting on real-world timers.

- [ ] **Step 1: Write failing tests**

```js
// tests/unit/nameMcCache.test.mjs
import { describe, it, expect, vi } from "vitest";
import { createNameMcCache } from "../../lib/discord/nameMcCache.mjs";

describe("getCached/setCached", () => {
  it("returns undefined for a missing key", () => {
    const cache = createNameMcCache({ cacheTtlMs: 1000, minIntervalMs: 0 });
    expect(cache.getCached("ExamplePlayer")).toBeUndefined();
  });

  it("returns a stored value before expiry, case-insensitively", () => {
    const cache = createNameMcCache({ cacheTtlMs: 10_000, minIntervalMs: 0 });
    cache.setCached("ExamplePlayer", { currentName: "ExamplePlayer" });
    expect(cache.getCached("exampleplayer")).toEqual({ currentName: "ExamplePlayer" });
  });

  it("returns undefined after expiry", async () => {
    vi.useFakeTimers();
    const cache = createNameMcCache({ cacheTtlMs: 10, minIntervalMs: 0 });
    cache.setCached("ExamplePlayer", { currentName: "ExamplePlayer" });
    vi.advanceTimersByTime(20);
    expect(cache.getCached("ExamplePlayer")).toBeUndefined();
    vi.useRealTimers();
  });
});

describe("dedupe", () => {
  it("only invokes fn once for concurrent calls with the same key", async () => {
    const cache = createNameMcCache({ cacheTtlMs: 1000, minIntervalMs: 0 });
    let calls = 0;
    const fn = () => {
      calls += 1;
      return new Promise((resolve) => setTimeout(() => resolve("done"), 10));
    };
    const [a, b] = await Promise.all([
      cache.dedupe("ExamplePlayer", fn),
      cache.dedupe("exampleplayer", fn),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe("done");
    expect(b).toBe("done");
  });

  it("invokes fn again for a subsequent call after the first resolves", async () => {
    const cache = createNameMcCache({ cacheTtlMs: 1000, minIntervalMs: 0 });
    let calls = 0;
    const fn = () => {
      calls += 1;
      return Promise.resolve("done");
    };
    await cache.dedupe("ExamplePlayer", fn);
    await cache.dedupe("ExamplePlayer", fn);
    expect(calls).toBe(2);
  });
});

describe("throttle", () => {
  it("serializes calls so each starts at least minIntervalMs after the previous", async () => {
    const cache = createNameMcCache({ cacheTtlMs: 1000, minIntervalMs: 50 });
    const starts = [];
    const fn = () => {
      starts.push(Date.now());
      return Promise.resolve();
    };
    await Promise.all([cache.throttle(fn), cache.throttle(fn), cache.throttle(fn)]);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(45);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(45);
  });
});
```

Run: `npx vitest run tests/unit/nameMcCache.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

```js
// lib/discord/nameMcCache.mjs
export function createNameMcCache({ cacheTtlMs, minIntervalMs }) {
  const cache = new Map(); // key -> { value, expiresAt }
  const inFlight = new Map(); // key -> Promise
  let lastCallStartedAt = 0;
  let throttleQueue = Promise.resolve();

  function key(username) {
    return username.toLowerCase();
  }

  function getCached(username) {
    const entry = cache.get(key(username));
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      cache.delete(key(username));
      return undefined;
    }
    return entry.value;
  }

  function setCached(username, value) {
    cache.set(key(username), { value, expiresAt: Date.now() + cacheTtlMs });
  }

  function dedupe(username, fn) {
    const k = key(username);
    if (inFlight.has(k)) {
      return inFlight.get(k);
    }
    const promise = fn().finally(() => inFlight.delete(k));
    inFlight.set(k, promise);
    return promise;
  }

  function throttle(fn) {
    const scheduled = throttleQueue.then(async () => {
      const now = Date.now();
      const wait = Math.max(0, lastCallStartedAt + minIntervalMs - now);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      lastCallStartedAt = Date.now();
      return fn();
    });
    // Chain the queue on the settled promise (ignore its result/error for scheduling purposes).
    throttleQueue = scheduled.then(
      () => undefined,
      () => undefined
    );
    return scheduled;
  }

  return { getCached, setCached, dedupe, throttle };
}
```

- [ ] **Step 3: Run tests and verify pass**

Run: `npx vitest run tests/unit/nameMcCache.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/discord/nameMcCache.mjs tests/unit/nameMcCache.test.mjs
git commit -m "feat: add in-memory cache, dedup, and throttle for NameMC lookups"
```

---

### Task 4a: Mojang identity resolution

**Files:**
- Create: `lib/discord/mojangApi.mjs`
- Test: `tests/unit/mojangApi.test.mjs`

**Interfaces:**
- Consumes: `node-fetch` (`fetch`).
- Produces:
  - `isValidUsername(username: string): boolean` — tests `^[A-Za-z0-9_]{3,16}$`.
  - `getAvatarUrl(uuid: string): string` — pure function, returns `` `https://crafatar.com/avatars/${uuid}?size=128&overlay` `` (no network call — Crafatar serves this directly from any valid UUID).
  - `createMojangApiClient({ requestTimeoutMs, fetchImpl })` returning `{ resolveUsername(username: string): Promise<Result> }` where `Result` is one of:
    - `{ status: "not_found" }` (Mojang returns 204/404 for an unknown username)
    - `{ status: "unavailable" }` (timeout, non-2xx/404 status, or malformed JSON)
    - `{ status: "found", uuid, currentName }` — `uuid` is the dashed form (`8-4-4-4-12`); Mojang's API returns it undashed, so this function inserts the dashes.
  - `fetchImpl` is injectable (defaults to `node-fetch`'s `fetch`) so tests never hit the real network.

- [ ] **Step 1: Write failing tests**

```js
// tests/unit/mojangApi.test.mjs
import { describe, it, expect, vi } from "vitest";
import { isValidUsername, getAvatarUrl, createMojangApiClient } from "../../lib/discord/mojangApi.mjs";

describe("isValidUsername", () => {
  it("accepts a valid username", () => {
    expect(isValidUsername("ExamplePlayer")).toBe(true);
  });
  it("rejects a username shorter than 3 chars", () => {
    expect(isValidUsername("ab")).toBe(false);
  });
  it("rejects a username with invalid characters", () => {
    expect(isValidUsername("bad name!")).toBe(false);
  });
  it("rejects a username longer than 16 chars", () => {
    expect(isValidUsername("a".repeat(17))).toBe(false);
  });
});

describe("getAvatarUrl", () => {
  it("builds a Crafatar URL from a UUID with no network call", () => {
    expect(getAvatarUrl("00000000-0000-0000-0000-000000000000")).toBe(
      "https://crafatar.com/avatars/00000000-0000-0000-0000-000000000000?size=128&overlay"
    );
  });
});

describe("resolveUsername", () => {
  it("resolves a valid username to a dashed uuid and current name", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "00000000000000000000000000000000", name: "CurrentPlayer" }),
    });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("CurrentPlayer");
    expect(result).toEqual({
      status: "found",
      uuid: "00000000-0000-0000-0000-000000000000",
      currentName: "CurrentPlayer",
    });
  });

  it("returns not_found for a 204 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 204, json: async () => ({}) });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("MissingPlayer");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a 404 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("MissingPlayer");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns unavailable on a non-404/204 error status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("ErrorPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable on 429", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("RateLimitedPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when fetch throws (e.g. timeout)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("timeout"));
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("TimeoutPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when the JSON body is malformed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
    });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("BrokenPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });
});
```

Run: `npx vitest run tests/unit/mojangApi.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

```js
// lib/discord/mojangApi.mjs
import fetchDefault from "node-fetch";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;
const USER_AGENT = "ZanderBot/1.0 (+namehistory-lookup; contact: staff)";

export function isValidUsername(username) {
  return typeof username === "string" && USERNAME_PATTERN.test(username);
}

export function getAvatarUrl(uuid) {
  return `https://crafatar.com/avatars/${uuid}?size=128&overlay`;
}

function insertDashes(undashedUuid) {
  return [
    undashedUuid.slice(0, 8),
    undashedUuid.slice(8, 12),
    undashedUuid.slice(12, 16),
    undashedUuid.slice(16, 20),
    undashedUuid.slice(20, 32),
  ].join("-");
}

export function createMojangApiClient({ requestTimeoutMs, fetchImpl = fetchDefault }) {
  async function resolveUsername(username) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(
        `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
        { headers: { "User-Agent": USER_AGENT }, signal: controller.signal }
      );

      if (response.status === 204 || response.status === 404) {
        return { status: "not_found" };
      }
      if (!response.ok) {
        return { status: "unavailable" };
      }

      const body = await response.json();
      if (!body?.id || !body?.name) {
        return { status: "unavailable" };
      }

      return {
        status: "found",
        uuid: insertDashes(body.id),
        currentName: body.name,
      };
    } catch {
      return { status: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { resolveUsername };
}
```

- [ ] **Step 3: Run tests and verify pass**

Run: `npx vitest run tests/unit/mojangApi.test.mjs`
Expected: PASS (11 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/discord/mojangApi.mjs tests/unit/mojangApi.test.mjs
git commit -m "feat: add Mojang API client for username/UUID resolution"
```

---

### Task 4b: NameMC previous-names service

**Files:**
- Create: `lib/discord/nameMcLookup.mjs`
- Test: `tests/unit/nameMcLookup.test.mjs`

**Interfaces:**
- Consumes: `node-fetch` (`fetch`), `cheerio`, `createNameMcCache` (Task 3).
- Produces:
  - `createNameMcPreviousNamesService({ requestTimeoutMs, cacheTtlMs, minIntervalMs, fetchImpl })` returning `{ fetchPreviousNames(uuid: string): Promise<Result> }` where `Result` is one of:
    - `{ status: "not_found" }` (NameMC has no profile page for this UUID — treated as "no tracked history", not an error, since Mojang already confirmed the account exists)
    - `{ status: "unavailable" }` (timeout, non-2xx/404 status, 429, or parse failure)
    - `{ status: "found", previousNames: [{name, changedAt: Date|null}] }`
  - `fetchImpl` is injectable (defaults to `node-fetch`'s `fetch`) so tests never hit the real network. Cache/dedup/throttle keys on `uuid` (not username) — NameMC is queried by UUID here.
  - Internal-only (not exported): `parsePreviousNames(html: string): Array<{name, changedAt}> | null` — isolates the `cheerio` selector logic (returns `null` if the page doesn't look like a valid profile page at all, distinct from a valid profile with zero previous names which returns `[]`).

- [ ] **Step 1: Write failing tests using fixture HTML**

```js
// tests/unit/nameMcLookup.test.mjs
import { describe, it, expect, vi } from "vitest";
import { createNameMcPreviousNamesService } from "../../lib/discord/nameMcLookup.mjs";

const PROFILE_HTML_MULTIPLE_NAMES = `
<html><body>
  <h1 class="mb-0">CurrentPlayer</h1>
  <div class="card-header">Name History</div>
  <div class="card-body">
    <div class="name-change-row" data-name="OriginalPlayer" data-changed-at="2025-01-04T00:00:00Z"></div>
    <div class="name-change-row" data-name="SecondPlayer" data-changed-at="2026-03-18T00:00:00Z"></div>
  </div>
</body></html>
`;

const PROFILE_HTML_NO_HISTORY = `
<html><body>
  <h1 class="mb-0">SoloPlayer</h1>
  <div class="card-header">Name History</div>
  <div class="card-body"></div>
</body></html>
`;

function fakeFetch(responses) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[call];
    call += 1;
    return r;
  });
}

const UUID = "00000000-0000-0000-0000-000000000000";

describe("fetchPreviousNames", () => {
  it("parses a profile with multiple previous names", async () => {
    const fetchImpl = fakeFetch([{ ok: true, status: 200, text: async () => PROFILE_HTML_MULTIPLE_NAMES }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({
      status: "found",
      previousNames: [
        { name: "OriginalPlayer", changedAt: new Date("2025-01-04T00:00:00Z") },
        { name: "SecondPlayer", changedAt: new Date("2026-03-18T00:00:00Z") },
      ],
    });
  });

  it("parses a profile with no previous names", async () => {
    const fetchImpl = fakeFetch([{ ok: true, status: 200, text: async () => PROFILE_HTML_NO_HISTORY }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "found", previousNames: [] });
  });

  it("returns not_found for a 404 response", async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 404, text: async () => "" }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns unavailable on a non-404 error status", async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 500, text: async () => "" }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable on 429", async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 429, text: async () => "" }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when fetch throws (e.g. timeout)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("timeout"));
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("caches a found result and does not call fetch again for the same uuid", async () => {
    const fetchImpl = fakeFetch([{ ok: true, status: 200, text: async () => PROFILE_HTML_NO_HISTORY }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 60_000, minIntervalMs: 0, fetchImpl });
    await service.fetchPreviousNames(UUID);
    const second = await service.fetchPreviousNames(UUID);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second.status).toBe("found");
  });

  it("deduplicates concurrent lookups for the same uuid", async () => {
    const fetchImpl = fakeFetch([{ ok: true, status: 200, text: async () => PROFILE_HTML_NO_HISTORY }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 60_000, minIntervalMs: 0, fetchImpl });
    const [a, b] = await Promise.all([
      service.fetchPreviousNames(UUID),
      service.fetchPreviousNames(UUID.toUpperCase()),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a.status).toBe("found");
    expect(b.status).toBe("found");
  });
});
```

Run: `npx vitest run tests/unit/nameMcLookup.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

```js
// lib/discord/nameMcLookup.mjs
import * as cheerio from "cheerio";
import fetchDefault from "node-fetch";
import { createNameMcCache } from "./nameMcCache.mjs";

const USER_AGENT = "ZanderBot/1.0 (+namehistory-lookup; contact: staff)";

export function parsePreviousNames(html) {
  const $ = cheerio.load(html);

  const currentName = $("h1.mb-0").first().text().trim();
  if (!currentName) return null;

  const previousNames = [];
  $(".name-change-row").each((_, el) => {
    const name = $(el).attr("data-name");
    const changedAtRaw = $(el).attr("data-changed-at");
    if (name) {
      previousNames.push({
        name,
        changedAt: changedAtRaw ? new Date(changedAtRaw) : null,
      });
    }
  });

  return previousNames;
}

export function createNameMcPreviousNamesService({ requestTimeoutMs, cacheTtlMs, minIntervalMs, fetchImpl = fetchDefault }) {
  const cache = createNameMcCache({ cacheTtlMs, minIntervalMs });

  async function fetchProfile(uuid) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(`https://namemc.com/profile/${encodeURIComponent(uuid)}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });

      if (response.status === 404) {
        return { status: "not_found" };
      }
      if (!response.ok) {
        // Includes 429 — treated as unavailable; caller relies on the throttle to
        // avoid hammering NameMC after this happens.
        return { status: "unavailable" };
      }

      const html = await response.text();
      const previousNames = parsePreviousNames(html);
      if (previousNames === null) {
        return { status: "not_found" };
      }

      return { status: "found", previousNames };
    } catch {
      return { status: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchPreviousNames(uuid) {
    const cached = cache.getCached(uuid);
    if (cached) return cached;

    const result = await cache.dedupe(uuid, () => cache.throttle(() => fetchProfile(uuid)));

    if (result.status === "found") {
      cache.setCached(uuid, result);
    }

    return result;
  }

  return { fetchPreviousNames };
}
```

- [ ] **Step 3: Run tests and verify pass**

Run: `npx vitest run tests/unit/nameMcLookup.test.mjs`
Expected: PASS (8 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/discord/nameMcLookup.mjs tests/unit/nameMcLookup.test.mjs
git commit -m "feat: add NameMC previous-names service scoped to history only"
```

---

### Task 4c: Name history lookup orchestrator

**Files:**
- Create: `lib/discord/nameHistoryLookup.mjs`
- Test: `tests/unit/nameHistoryLookup.test.mjs`

**Interfaces:**
- Consumes: `isValidUsername`, `getAvatarUrl`, `createMojangApiClient` (Task 4a); `createNameMcPreviousNamesService` (Task 4b).
- Produces: `createNameHistoryLookupService({ requestTimeoutMs, cacheTtlMs, minIntervalMs, fetchImpl })` returning `{ lookupNameHistory(username: string): Promise<Result> }` where `Result` is one of:
  - `{ status: "invalid" }`
  - `{ status: "not_found" }`
  - `{ status: "unavailable" }`
  - `{ status: "found", currentName, uuid, previousNames: [{name, changedAt}], profileUrl, avatarUrl }` — `profileUrl` is `` `https://namemc.com/profile/${uuid}` ``, `avatarUrl` is `getAvatarUrl(uuid)`.
  This is the function `commands/namehistory.mjs` (Task 7) actually calls — it composes Task 4a and 4b and implements the Global-Constraints rule that a Mojang success + NameMC failure collapses to overall `unavailable`, and a NameMC `not_found` (valid Mojang account, no NameMC-tracked history) collapses to `found` with `previousNames: []`.

- [ ] **Step 1: Write failing tests with injected mock clients**

```js
// tests/unit/nameHistoryLookup.test.mjs
import { describe, it, expect, vi } from "vitest";
import { createNameHistoryLookupService } from "../../lib/discord/nameHistoryLookup.mjs";

function buildService({ mojangClient, nameMcService }) {
  return createNameHistoryLookupService({
    requestTimeoutMs: 1000,
    cacheTtlMs: 1000,
    minIntervalMs: 0,
    mojangClient,
    nameMcService,
  });
}

describe("lookupNameHistory", () => {
  it("returns invalid for a malformed username without calling either client", async () => {
    const mojangClient = { resolveUsername: vi.fn() };
    const nameMcService = { fetchPreviousNames: vi.fn() };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("bad name!");
    expect(result).toEqual({ status: "invalid" });
    expect(mojangClient.resolveUsername).not.toHaveBeenCalled();
    expect(nameMcService.fetchPreviousNames).not.toHaveBeenCalled();
  });

  it("returns not_found when Mojang has no such username", async () => {
    const mojangClient = { resolveUsername: vi.fn().mockResolvedValue({ status: "not_found" }) };
    const nameMcService = { fetchPreviousNames: vi.fn() };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("MissingPlayer");
    expect(result).toEqual({ status: "not_found" });
    expect(nameMcService.fetchPreviousNames).not.toHaveBeenCalled();
  });

  it("returns unavailable when Mojang is unavailable", async () => {
    const mojangClient = { resolveUsername: vi.fn().mockResolvedValue({ status: "unavailable" }) };
    const nameMcService = { fetchPreviousNames: vi.fn() };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("ErrorPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns found with previousNames when both steps succeed", async () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    const mojangClient = {
      resolveUsername: vi.fn().mockResolvedValue({ status: "found", uuid, currentName: "CurrentPlayer" }),
    };
    const nameMcService = {
      fetchPreviousNames: vi.fn().mockResolvedValue({
        status: "found",
        previousNames: [{ name: "OldPlayer", changedAt: new Date("2025-01-04T00:00:00Z") }],
      }),
    };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("CurrentPlayer");
    expect(result).toEqual({
      status: "found",
      currentName: "CurrentPlayer",
      uuid,
      previousNames: [{ name: "OldPlayer", changedAt: new Date("2025-01-04T00:00:00Z") }],
      profileUrl: `https://namemc.com/profile/${uuid}`,
      avatarUrl: `https://crafatar.com/avatars/${uuid}?size=128&overlay`,
    });
  });

  it("returns found with empty previousNames when NameMC has no tracked history", async () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    const mojangClient = {
      resolveUsername: vi.fn().mockResolvedValue({ status: "found", uuid, currentName: "SoloPlayer" }),
    };
    const nameMcService = { fetchPreviousNames: vi.fn().mockResolvedValue({ status: "not_found" }) };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("SoloPlayer");
    expect(result.status).toBe("found");
    expect(result.previousNames).toEqual([]);
  });

  it("collapses a Mojang success + NameMC unavailable into overall unavailable", async () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    const mojangClient = {
      resolveUsername: vi.fn().mockResolvedValue({ status: "found", uuid, currentName: "CurrentPlayer" }),
    };
    const nameMcService = { fetchPreviousNames: vi.fn().mockResolvedValue({ status: "unavailable" }) };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("CurrentPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });
});
```

Run: `npx vitest run tests/unit/nameHistoryLookup.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

```js
// lib/discord/nameHistoryLookup.mjs
import { isValidUsername, getAvatarUrl, createMojangApiClient } from "./mojangApi.mjs";
import { createNameMcPreviousNamesService } from "./nameMcLookup.mjs";

export function createNameHistoryLookupService({
  requestTimeoutMs,
  cacheTtlMs,
  minIntervalMs,
  fetchImpl,
  mojangClient = createMojangApiClient({ requestTimeoutMs, fetchImpl }),
  nameMcService = createNameMcPreviousNamesService({ requestTimeoutMs, cacheTtlMs, minIntervalMs, fetchImpl }),
}) {
  async function lookupNameHistory(username) {
    if (!isValidUsername(username)) {
      return { status: "invalid" };
    }

    const identity = await mojangClient.resolveUsername(username);
    if (identity.status !== "found") {
      return identity; // "not_found" or "unavailable"
    }

    const history = await nameMcService.fetchPreviousNames(identity.uuid);
    if (history.status === "unavailable") {
      return { status: "unavailable" };
    }

    const previousNames = history.status === "found" ? history.previousNames : [];

    return {
      status: "found",
      currentName: identity.currentName,
      uuid: identity.uuid,
      previousNames,
      profileUrl: `https://namemc.com/profile/${identity.uuid}`,
      avatarUrl: getAvatarUrl(identity.uuid),
    };
  }

  return { lookupNameHistory };
}
```

- [ ] **Step 3: Run tests and verify pass**

Run: `npx vitest run tests/unit/nameHistoryLookup.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/discord/nameHistoryLookup.mjs tests/unit/nameHistoryLookup.test.mjs
git commit -m "feat: compose Mojang identity and NameMC history into one lookup service"
```

---

### Task 5: Embed formatting and cooldown helpers

**Files:**
- Create: `lib/discord/nameHistoryFormat.mjs`
- Test: `tests/unit/nameHistoryFormat.test.mjs`

**Interfaces:**
- Produces:
  - `buildNameHistoryEmbedData(result: FoundResult): {title, fields: [{name, value}], footer, thumbnailUrl}` where `result` is a `{status: "found", ...}` object from Task 4. Uses `sanitizeExternalText` (Task 2) on `currentName` and every previous name. If `previousNames` is empty, the "Previous names" field value is exactly `"No previous usernames were found on NameMC for this profile."`.
  - `NOT_FOUND_MESSAGE(username)` → `` `No NameMC profile could be found for "${username}".` `` (username passed through `sanitizeExternalText`).
  - `UNAVAILABLE_MESSAGE` → `"NameMC is currently unavailable, so this username could not be checked. Please try again later."`
  - `createCooldownTracker(cooldownSeconds)` returning `{ isOnCooldown(discordUserId, isAdmin): boolean, recordUse(discordUserId): void }` — admins bypass the per-user cooldown when `isAdmin` is true; there is no bypass parameter for the global rate limiter (that lives entirely in Task 3/4 and is untouched by this tracker).

- [ ] **Step 1: Write failing tests**

```js
// tests/unit/nameHistoryFormat.test.mjs
import { describe, it, expect, vi } from "vitest";
import {
  buildNameHistoryEmbedData,
  NOT_FOUND_MESSAGE,
  UNAVAILABLE_MESSAGE,
  createCooldownTracker,
} from "../../lib/discord/nameHistoryFormat.mjs";

describe("buildNameHistoryEmbedData", () => {
  it("lists previous names with change dates", () => {
    const data = buildNameHistoryEmbedData({
      status: "found",
      currentName: "CurrentPlayer",
      uuid: "00000000-0000-0000-0000-000000000000",
      previousNames: [
        { name: "OriginalPlayer", changedAt: new Date("2025-01-04T00:00:00Z") },
        { name: "SecondPlayer", changedAt: new Date("2026-03-18T00:00:00Z") },
      ],
      profileUrl: "https://namemc.com/profile/CurrentPlayer",
      avatarUrl: "https://namemc.com/avatar/CurrentPlayer.png",
    });
    expect(data.title).toContain("CurrentPlayer");
    const previousField = data.fields.find((f) => f.name === "Previous names");
    expect(previousField.value).toContain("OriginalPlayer");
    expect(previousField.value).toContain("SecondPlayer");
    expect(data.footer).toContain("NameMC");
    expect(data.thumbnailUrl).toBe("https://namemc.com/avatar/CurrentPlayer.png");
  });

  it("shows the no-history message when previousNames is empty", () => {
    const data = buildNameHistoryEmbedData({
      status: "found",
      currentName: "SoloPlayer",
      uuid: "1",
      previousNames: [],
      profileUrl: "https://namemc.com/profile/SoloPlayer",
      avatarUrl: null,
    });
    const previousField = data.fields.find((f) => f.name === "Previous names");
    expect(previousField.value).toBe("No previous usernames were found on NameMC for this profile.");
  });

  it("sanitizes mention-like content in names", () => {
    const data = buildNameHistoryEmbedData({
      status: "found",
      currentName: "@everyone",
      uuid: "1",
      previousNames: [],
      profileUrl: "https://namemc.com/profile/x",
      avatarUrl: null,
    });
    expect(data.title).not.toContain("@everyone");
  });
});

describe("NOT_FOUND_MESSAGE / UNAVAILABLE_MESSAGE", () => {
  it("formats the not-found message with the username", () => {
    expect(NOT_FOUND_MESSAGE("ExamplePlayer")).toBe(
      'No NameMC profile could be found for "ExamplePlayer".'
    );
  });

  it("has a fixed unavailable message", () => {
    expect(UNAVAILABLE_MESSAGE).toBe(
      "NameMC is currently unavailable, so this username could not be checked. Please try again later."
    );
  });
});

describe("createCooldownTracker", () => {
  it("is not on cooldown before first use", () => {
    const tracker = createCooldownTracker(10);
    expect(tracker.isOnCooldown("user-1", false)).toBe(false);
  });

  it("is on cooldown immediately after use for a non-admin", () => {
    const tracker = createCooldownTracker(10);
    tracker.recordUse("user-1");
    expect(tracker.isOnCooldown("user-1", false)).toBe(true);
  });

  it("admins bypass the per-user cooldown", () => {
    const tracker = createCooldownTracker(10);
    tracker.recordUse("user-1");
    expect(tracker.isOnCooldown("user-1", true)).toBe(false);
  });

  it("cooldown clears after the window passes", () => {
    vi.useFakeTimers();
    const tracker = createCooldownTracker(10);
    tracker.recordUse("user-1");
    vi.advanceTimersByTime(11_000);
    expect(tracker.isOnCooldown("user-1", false)).toBe(false);
    vi.useRealTimers();
  });
});
```

Run: `npx vitest run tests/unit/nameHistoryFormat.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

```js
// lib/discord/nameHistoryFormat.mjs
import { sanitizeExternalText } from "./textSanitize.mjs";

export function buildNameHistoryEmbedData(result) {
  const currentName = sanitizeExternalText(result.currentName);
  const previousNamesText =
    result.previousNames.length === 0
      ? "No previous usernames were found on NameMC for this profile."
      : result.previousNames
          .map((p) => {
            const name = sanitizeExternalText(p.name);
            if (!p.changedAt) return name;
            const date = p.changedAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            return `${name} — changed ${date}`;
          })
          .join("\n");

  return {
    title: `Name History — ${currentName}`,
    fields: [
      { name: "Current name", value: currentName },
      { name: "UUID", value: result.uuid ?? "Unknown" },
      { name: "Previous names", value: previousNamesText },
      { name: "Profile", value: result.profileUrl },
    ],
    footer: `Source: NameMC · Retrieved ${new Date().toLocaleString("en-GB")}`,
    thumbnailUrl: result.avatarUrl,
  };
}

export function NOT_FOUND_MESSAGE(username) {
  return `No NameMC profile could be found for "${sanitizeExternalText(username)}".`;
}

export const UNAVAILABLE_MESSAGE =
  "NameMC is currently unavailable, so this username could not be checked. Please try again later.";

export function createCooldownTracker(cooldownSeconds) {
  const lastUse = new Map();

  return {
    isOnCooldown(discordUserId, isAdmin) {
      if (isAdmin) return false;
      const last = lastUse.get(discordUserId);
      if (!last) return false;
      return Date.now() - last < cooldownSeconds * 1000;
    },
    recordUse(discordUserId) {
      lastUse.set(discordUserId, Date.now());
    },
  };
}
```

- [ ] **Step 3: Run tests and verify pass**

Run: `npx vitest run tests/unit/nameHistoryFormat.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/discord/nameHistoryFormat.mjs tests/unit/nameHistoryFormat.test.mjs
git commit -m "feat: add name-history embed formatting and cooldown tracker"
```

---

### Task 6: Config and feature flag additions

**Files:**
- Modify: `config.json.example`
- Modify: `features.json`

**Interfaces:**
- Produces: `config.discord.namehistory = { allowedChannelIds, cooldownSeconds, cacheDurationMinutes, requestTimeoutSeconds, publicResults }`, `features.discord.namehistory = boolean`.

- [ ] **Step 1: Add config block**

In `config.json.example`, inside `"discord": { ... }`, add:

```json
    "namehistory": {
      "allowedChannelIds": [],
      "cooldownSeconds": 10,
      "cacheDurationMinutes": 60,
      "requestTimeoutSeconds": 10,
      "publicResults": true
    }
```

- [ ] **Step 2: Add feature flag**

In `features.json`, inside `"discord": { ... }`, add:

```json
    "namehistory": true
```

- [ ] **Step 3: Verify JSON validity**

Run: `node -e "require('./config.json.example'); require('./features.json'); console.log('valid')"`
Expected: prints `valid`

- [ ] **Step 4: Commit**

```bash
git add config.json.example features.json
git commit -m "feat: add namehistory config and feature flag"
```

---

### Task 7: `/namehistory` and `/nh` Discord commands

**Files:**
- Create: `commands/namehistory.mjs`
- Test: `tests/unit/namehistoryCommand.test.mjs`

**Interfaces:**
- Consumes: `isValidUsername` (Task 4a, re-used here for the pre-dispatch local check — the test in Step 1 asserts the lookup service is never called for an invalid username), `createNameHistoryLookupService` (Task 4c), `buildNameHistoryEmbedData`/`NOT_FOUND_MESSAGE`/`UNAVAILABLE_MESSAGE`/`createCooldownTracker` (Task 5), `config.discord.namehistory`, `features.discord.namehistory`.
- Produces: exported `handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin })` — the shared, testable core (channel/cooldown/validation checks + reply construction) that both the `NameHistoryCommand` and `NhCommand` Sapphire classes call from their thin `chatInputRun`.

- [ ] **Step 1: Write failing tests for the shared handler**

```js
// tests/unit/namehistoryCommand.test.mjs
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleNameHistoryLookup } from "../../commands/namehistory.mjs";

function fakeInteraction({ username, channelId = "chan-1", userId = "user-1", isAdmin = false } = {}) {
  const replies = [];
  return {
    options: { getString: () => username },
    channelId,
    user: { id: userId },
    deferReply: vi.fn().mockResolvedValue(),
    editReply: vi.fn(async (payload) => {
      replies.push(payload);
      return payload;
    }),
    memberPermissions: { has: () => isAdmin },
    _replies: replies,
  };
}

describe("handleNameHistoryLookup", () => {
  it("rejects an invalid username without calling the lookup service", async () => {
    const lookupService = { lookupNameHistory: vi.fn() };
    const cooldownTracker = { isOnCooldown: () => false, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "bad name!" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(lookupService.lookupNameHistory).not.toHaveBeenCalled();
    expect(interaction._replies[0].content).toMatch(/valid Minecraft username/i);
  });

  it("returns the not-found message for a missing profile", async () => {
    const lookupService = { lookupNameHistory: vi.fn().mockResolvedValue({ status: "not_found" }) };
    const cooldownTracker = { isOnCooldown: () => false, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "MissingPlayer" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(interaction._replies[0].content).toBe('No NameMC profile could be found for "MissingPlayer".');
  });

  it("returns the unavailable message on unavailable status", async () => {
    const lookupService = { lookupNameHistory: vi.fn().mockResolvedValue({ status: "unavailable" }) };
    const cooldownTracker = { isOnCooldown: () => false, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "ErrorPlayer" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(interaction._replies[0].content).toMatch(/currently unavailable/i);
  });

  it("returns an embed for a found profile and records cooldown use", async () => {
    const lookupService = {
      lookupNameHistory: vi.fn().mockResolvedValue({
        status: "found",
        currentName: "CurrentPlayer",
        uuid: "00000000-0000-0000-0000-000000000000",
        previousNames: [],
        profileUrl: "https://namemc.com/profile/CurrentPlayer",
        avatarUrl: null,
      }),
    };
    const cooldownTracker = { isOnCooldown: () => false, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "CurrentPlayer" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(interaction._replies[0].embeds).toHaveLength(1);
    expect(cooldownTracker.recordUse).toHaveBeenCalledWith("user-1");
  });

  it("blocks a non-admin on cooldown with an ephemeral message and does not call the lookup service", async () => {
    const lookupService = { lookupNameHistory: vi.fn() };
    const cooldownTracker = { isOnCooldown: () => true, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "CurrentPlayer" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(lookupService.lookupNameHistory).not.toHaveBeenCalled();
    expect(interaction._replies[0].content).toMatch(/cooldown/i);
  });

  it("does not apply the per-user cooldown check for an admin", async () => {
    const lookupService = { lookupNameHistory: vi.fn().mockResolvedValue({ status: "not_found" }) };
    const cooldownTracker = { isOnCooldown: (id, isAdmin) => !isAdmin, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "CurrentPlayer", isAdmin: true });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: true });

    expect(lookupService.lookupNameHistory).toHaveBeenCalled();
  });
});
```

Run: `npx vitest run tests/unit/namehistoryCommand.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

```js
// commands/namehistory.mjs
import { Command } from "@sapphire/framework";
import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { createRequire } from "module";
import { isValidUsername } from "../lib/discord/mojangApi.mjs";
import { createNameHistoryLookupService } from "../lib/discord/nameHistoryLookup.mjs";
import {
  buildNameHistoryEmbedData,
  NOT_FOUND_MESSAGE,
  UNAVAILABLE_MESSAGE,
  createCooldownTracker,
} from "../lib/discord/nameHistoryFormat.mjs";

const require = createRequire(import.meta.url);
const config = require("../config.json");
const features = require("../features.json");

const NH_CONFIG = config?.discord?.namehistory ?? {};
const ALLOWED_CHANNEL_IDS = NH_CONFIG.allowedChannelIds ?? [];
const COOLDOWN_SECONDS = NH_CONFIG.cooldownSeconds ?? 10;
const CACHE_DURATION_MINUTES = NH_CONFIG.cacheDurationMinutes ?? 60;
const REQUEST_TIMEOUT_SECONDS = NH_CONFIG.requestTimeoutSeconds ?? 10;
const PUBLIC_RESULTS = NH_CONFIG.publicResults ?? true;

const sharedLookupService = createNameHistoryLookupService({
  requestTimeoutMs: REQUEST_TIMEOUT_SECONDS * 1000,
  cacheTtlMs: CACHE_DURATION_MINUTES * 60 * 1000,
  minIntervalMs: 500,
});
const sharedCooldownTracker = createCooldownTracker(COOLDOWN_SECONDS);

function addNameHistoryOption(builder) {
  return builder.addStringOption((opt) =>
    opt.setName("username").setDescription("Minecraft username").setRequired(true)
  );
}

export async function handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin }) {
  const username = interaction.options.getString("username");

  if (ALLOWED_CHANNEL_IDS.length > 0 && !ALLOWED_CHANNEL_IDS.includes(interaction.channelId)) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({ content: "This command isn't available in this channel." });
  }

  if (!isValidUsername(username)) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({ content: "That is not a valid Minecraft username." });
  }

  if (cooldownTracker.isOnCooldown(interaction.user.id, isAdmin)) {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({ content: `You're on cooldown — please wait before running this command again.` });
  }

  await interaction.deferReply({ ephemeral: !PUBLIC_RESULTS });
  cooldownTracker.recordUse(interaction.user.id);

  const result = await lookupService.lookupNameHistory(username);

  if (result.status === "not_found") {
    return interaction.editReply({ content: NOT_FOUND_MESSAGE(username) });
  }
  if (result.status === "unavailable") {
    return interaction.editReply({ content: UNAVAILABLE_MESSAGE });
  }
  if (result.status === "invalid") {
    return interaction.editReply({ content: "That is not a valid Minecraft username." });
  }

  const data = buildNameHistoryEmbedData(result);
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .addFields(data.fields)
    .setFooter({ text: data.footer });
  if (data.thumbnailUrl) embed.setThumbnail(data.thumbnailUrl);

  return interaction.editReply({ embeds: [embed] });
}

function isInteractionAdmin(interaction) {
  return Boolean(interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator));
}

export class NameHistoryCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    if (!features?.discord?.namehistory) return;
    const builder = addNameHistoryOption(
      new SlashCommandBuilder().setName("namehistory").setDescription("Look up a Minecraft player's NameMC username history.")
    );
    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    return handleNameHistoryLookup(interaction, {
      lookupService: sharedLookupService,
      cooldownTracker: sharedCooldownTracker,
      isAdmin: isInteractionAdmin(interaction),
    });
  }
}

export class NhCommand extends Command {
  constructor(context, options) {
    super(context, { ...options });
  }

  registerApplicationCommands(registry) {
    if (!features?.discord?.namehistory) return;
    const builder = addNameHistoryOption(
      new SlashCommandBuilder().setName("nh").setDescription("Alias for /namehistory.")
    );
    registry.registerChatInputCommand(builder);
  }

  async chatInputRun(interaction) {
    return handleNameHistoryLookup(interaction, {
      lookupService: sharedLookupService,
      cooldownTracker: sharedCooldownTracker,
      isAdmin: isInteractionAdmin(interaction),
    });
  }
}
```

- [ ] **Step 3: Run tests and verify pass**

Run: `npx vitest run tests/unit/namehistoryCommand.test.mjs`
Expected: PASS (6 tests)

Run the full suite: `npm test`
Expected: all tests pass, including every prior task's tests plus `/ipcheck` plan's tests if implemented in the same branch.

- [ ] **Step 4: Commit**

```bash
git add commands/namehistory.mjs tests/unit/namehistoryCommand.test.mjs
git commit -m "feat: add /namehistory and /nh Discord commands"
```

---

### Task 8: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm command registration**

Start the bot locally (`npm run dev`). Confirm `/namehistory` and `/nh` both appear as separate commands with a required `username` option.

- [ ] **Step 2: Exercise the happy path**

Run `/namehistory username:<a known Minecraft username with name history>`. Confirm: reply is public (not ephemeral) by default, embed shows current name, UUID, previous names with dates, profile link, avatar thumbnail, and a "Source: NameMC" footer. Run `/nh` with the same username and confirm an identical result.

- [ ] **Step 3: Exercise edge cases**

Run with a username containing invalid characters (confirm ephemeral rejection, no network call — check logs show no NameMC request), a username with no history (confirm the exact "No previous usernames..." text), and a nonexistent username (confirm the exact not-found text). Immediately re-run the same command as the same user and confirm the cooldown message appears.

- [ ] **Step 4: Confirm graceful degradation**

Temporarily set `requestTimeoutSeconds` very low (e.g. `0.001`) in `config.json` and re-run the command; confirm the "NameMC is currently unavailable..." message appears rather than an unhandled error. Revert the config change afterward.

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during namehistory manual verification"
```
