/**
 * Tests for applicationEligibilityController.js
 *
 * Run with: node --test tests/applicationEligibility.test.js
 *
 * These tests exercise the pure evaluateEligibilityRules() function, which
 * contains all the decision logic and has no I/O dependencies.  Database-bound
 * helpers (getPlaytimeHours, etc.) are covered with lightweight integration
 * checks that verify contract shapes rather than DB results.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { evaluateEligibilityRules } from "../controllers/applicationEligibilityRules.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal rules object — every field off / null. */
function baseRules(overrides = {}) {
  return {
    minimum_playtime_hours: null,
    block_if_currently_banned: 0,
    block_if_ever_banned: 0,
    punishment_lookback_months: null,
    max_punishments_in_lookback: null,
    block_if_banned_on_any_platform: 0,
    require_discord_activity: 0,
    discord_activity_lookback_days: null,
    minimum_discord_messages: null,
    ...overrides,
  };
}

/** Fully-qualified user data — all checks pass. */
function goodData(overrides = {}) {
  return {
    hasMinecraftAccount: true,
    playtimeHours: 200,
    currentlyBanned: false,
    everBanned: false,
    punishmentsInLookback: 0,
    platformBanned: false,
    platformBanSources: [],
    hasDiscordAccount: true,
    discordMessageCount: 50,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("evaluateEligibilityRules", () => {

  // ── All conditions met ──────────────────────────────────────────────────────
  test("user meets all conditions and can apply", () => {
    const rules = baseRules({
      minimum_playtime_hours: 50,
      block_if_currently_banned: 1,
      punishment_lookback_months: 6,
      max_punishments_in_lookback: 0,
      require_discord_activity: 1,
      discord_activity_lookback_days: 30,
      minimum_discord_messages: 25,
    });
    const result = evaluateEligibilityRules(rules, goodData());
    assert.equal(result.eligible, true);
    assert.deepEqual(result.failedRules, []);
  });

  // ── No rules ────────────────────────────────────────────────────────────────
  test("user is eligible when no rules require anything (all null / disabled)", () => {
    const result = evaluateEligibilityRules(baseRules(), goodData());
    assert.equal(result.eligible, true);
    assert.deepEqual(result.failedRules, []);
  });

  // ── Playtime ────────────────────────────────────────────────────────────────
  test("user does not meet minimum playtime", () => {
    const rules = baseRules({ minimum_playtime_hours: 50 });
    const result = evaluateEligibilityRules(rules, goodData({ playtimeHours: 32 }));
    assert.equal(result.eligible, false);
    const codes = result.failedRules.map((r) => r.code);
    assert.ok(codes.includes("MINIMUM_PLAYTIME_NOT_MET"));
    assert.ok(result.failedRules[0].message.includes("50 hours"));
    assert.ok(result.failedRules[0].message.includes("32 hours"));
    assert.equal(result.snapshot.playtime_hours, 32);
  });

  test("user has no linked Minecraft account but playtime is required", () => {
    const rules = baseRules({ minimum_playtime_hours: 50 });
    const result = evaluateEligibilityRules(rules, goodData({ hasMinecraftAccount: false }));
    assert.equal(result.eligible, false);
    const codes = result.failedRules.map((r) => r.code);
    assert.ok(codes.includes("NO_LINKED_MINECRAFT_ACCOUNT"));
    assert.equal(result.snapshot.playtime_hours, 0);
  });

  test("user with exactly minimum playtime is eligible", () => {
    const rules = baseRules({ minimum_playtime_hours: 50 });
    const result = evaluateEligibilityRules(rules, goodData({ playtimeHours: 50 }));
    assert.equal(result.eligible, true);
  });

  // ── Active ban ───────────────────────────────────────────────────────────────
  test("user is currently banned", () => {
    const rules = baseRules({ block_if_currently_banned: 1 });
    const result = evaluateEligibilityRules(rules, goodData({ currentlyBanned: true }));
    assert.equal(result.eligible, false);
    assert.ok(result.failedRules.some((r) => r.code === "CURRENTLY_BANNED"));
    assert.equal(result.snapshot.currently_banned, true);
  });

  test("user without active ban passes the currently-banned check", () => {
    const rules = baseRules({ block_if_currently_banned: 1 });
    const result = evaluateEligibilityRules(rules, goodData({ currentlyBanned: false }));
    assert.equal(result.eligible, true);
  });

  // ── Ever banned ───────────────────────────────────────────────────────────────
  test("user who was ever banned is blocked when block_if_ever_banned is set", () => {
    const rules = baseRules({ block_if_ever_banned: 1 });
    const result = evaluateEligibilityRules(rules, goodData({ everBanned: true }));
    assert.equal(result.eligible, false);
    assert.ok(result.failedRules.some((r) => r.code === "EVER_BANNED"));
  });

  // ── Punishment lookback ───────────────────────────────────────────────────────
  test("user has a punishment inside the lookback window (0 allowed)", () => {
    const rules = baseRules({
      punishment_lookback_months: 6,
      max_punishments_in_lookback: 0,
    });
    const result = evaluateEligibilityRules(rules, goodData({ punishmentsInLookback: 1 }));
    assert.equal(result.eligible, false);
    assert.ok(result.failedRules.some((r) => r.code === "PUNISHMENTS_IN_LOOKBACK"));
    assert.ok(result.failedRules[0].message.includes("6 month"));
  });

  test("user has an old punishment outside the lookback window and is allowed", () => {
    // 0 punishments within the window (old punishment excluded by DB query date filter)
    const rules = baseRules({
      punishment_lookback_months: 6,
      max_punishments_in_lookback: 0,
    });
    const result = evaluateEligibilityRules(rules, goodData({ punishmentsInLookback: 0 }));
    assert.equal(result.eligible, true);
    assert.deepEqual(result.failedRules, []);
  });

  test("user exceeds max_punishments_in_lookback threshold", () => {
    const rules = baseRules({
      punishment_lookback_months: 3,
      max_punishments_in_lookback: 2,
    });
    const result = evaluateEligibilityRules(rules, goodData({ punishmentsInLookback: 5 }));
    assert.equal(result.eligible, false);
    assert.ok(result.failedRules.some((r) => r.code === "TOO_MANY_PUNISHMENTS_IN_LOOKBACK"));
    assert.ok(result.failedRules[0].message.includes("2 punishments"));
    assert.ok(result.failedRules[0].message.includes("5"));
  });

  test("user at exactly max_punishments_in_lookback threshold is eligible", () => {
    const rules = baseRules({
      punishment_lookback_months: 3,
      max_punishments_in_lookback: 2,
    });
    const result = evaluateEligibilityRules(rules, goodData({ punishmentsInLookback: 2 }));
    assert.equal(result.eligible, true);
  });

  // ── Platform-wide ban ────────────────────────────────────────────────────────
  test("user is banned on another CFC platform", () => {
    const rules = baseRules({ block_if_banned_on_any_platform: 1 });
    const result = evaluateEligibilityRules(
      rules,
      goodData({ platformBanned: true, platformBanSources: ["web"] })
    );
    assert.equal(result.eligible, false);
    assert.ok(result.failedRules.some((r) => r.code === "BANNED_ON_PLATFORM"));
    assert.deepEqual(result.snapshot.platform_ban_sources, ["web"]);
  });

  test("user with no platform bans passes the platform ban check", () => {
    const rules = baseRules({ block_if_banned_on_any_platform: 1 });
    const result = evaluateEligibilityRules(
      rules,
      goodData({ platformBanned: false, platformBanSources: [] })
    );
    assert.equal(result.eligible, true);
  });

  // ── Discord activity ──────────────────────────────────────────────────────────
  test("user has no linked Discord account but Discord activity is required", () => {
    const rules = baseRules({
      require_discord_activity: 1,
      discord_activity_lookback_days: 30,
      minimum_discord_messages: 25,
    });
    const result = evaluateEligibilityRules(rules, goodData({ hasDiscordAccount: false }));
    assert.equal(result.eligible, false);
    assert.ok(result.failedRules.some((r) => r.code === "NO_LINKED_DISCORD_ACCOUNT"));
    assert.equal(result.snapshot.discord_message_count, 0);
  });

  test("user has insufficient Discord activity", () => {
    const rules = baseRules({
      require_discord_activity: 1,
      discord_activity_lookback_days: 30,
      minimum_discord_messages: 25,
    });
    const result = evaluateEligibilityRules(rules, goodData({ discordMessageCount: 10 }));
    assert.equal(result.eligible, false);
    assert.ok(result.failedRules.some((r) => r.code === "INSUFFICIENT_DISCORD_ACTIVITY"));
    assert.ok(result.failedRules[0].message.includes("25"));
    assert.ok(result.failedRules[0].message.includes("10"));
    assert.equal(result.snapshot.discord_message_count, 10);
  });

  test("user has enough Discord activity", () => {
    const rules = baseRules({
      require_discord_activity: 1,
      discord_activity_lookback_days: 30,
      minimum_discord_messages: 25,
    });
    const result = evaluateEligibilityRules(rules, goodData({ discordMessageCount: 30 }));
    assert.equal(result.eligible, true);
    assert.deepEqual(result.failedRules, []);
  });

  test("user with exactly minimum Discord messages is eligible", () => {
    const rules = baseRules({
      require_discord_activity: 1,
      discord_activity_lookback_days: 30,
      minimum_discord_messages: 25,
    });
    const result = evaluateEligibilityRules(rules, goodData({ discordMessageCount: 25 }));
    assert.equal(result.eligible, true);
  });

  // ── Re-check on submission ────────────────────────────────────────────────────
  test("eligibility re-evaluated on submit blocks user who became ineligible", () => {
    // User loaded form when they had 50h, but now has only 5h
    const rules = baseRules({ minimum_playtime_hours: 50 });
    const result = evaluateEligibilityRules(rules, goodData({ playtimeHours: 5 }));
    assert.equal(result.eligible, false);
    assert.ok(result.failedRules.some((r) => r.code === "MINIMUM_PLAYTIME_NOT_MET"));
  });

  // ── Multiple simultaneous failures ───────────────────────────────────────────
  test("all failed rules are returned when multiple checks fail", () => {
    const rules = baseRules({
      minimum_playtime_hours: 50,
      block_if_currently_banned: 1,
      require_discord_activity: 1,
      discord_activity_lookback_days: 30,
      minimum_discord_messages: 25,
    });
    const result = evaluateEligibilityRules(rules, {
      hasMinecraftAccount: true,
      playtimeHours: 10,       // fails
      currentlyBanned: true,   // fails
      everBanned: false,
      punishmentsInLookback: 0,
      platformBanned: false,
      platformBanSources: [],
      hasDiscordAccount: true,
      discordMessageCount: 5,  // fails
    });
    assert.equal(result.eligible, false);
    assert.equal(result.failedRules.length, 3);
    const codes = result.failedRules.map((r) => r.code);
    assert.ok(codes.includes("MINIMUM_PLAYTIME_NOT_MET"));
    assert.ok(codes.includes("CURRENTLY_BANNED"));
    assert.ok(codes.includes("INSUFFICIENT_DISCORD_ACTIVITY"));
  });

  // ── Snapshot structure ───────────────────────────────────────────────────────
  test("snapshot contains correct playtime value when playtime check runs", () => {
    const rules = baseRules({ minimum_playtime_hours: 100 });
    const result = evaluateEligibilityRules(rules, goodData({ playtimeHours: 72 }));
    assert.equal(result.snapshot.playtime_hours, 72);
  });

  test("snapshot playtime_hours is null when playtime rule is disabled", () => {
    const result = evaluateEligibilityRules(baseRules(), goodData());
    assert.equal(result.snapshot.playtime_hours, null);
  });
});
