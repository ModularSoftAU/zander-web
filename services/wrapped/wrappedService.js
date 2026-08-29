import { resolveWrappedPeriod } from "../../lib/wrapped/period.js";
import { rankOf, pctChange, vibeLabel, humanizeDuration } from "../../lib/wrapped/derive.js";
import { fetchWrappedStats, isMineMonitorConfigured } from "./minemonitorClient.js";
import {
  generateShareId,
  getZanderStatsForUser,
  getZanderLeaderboardRaw,
  getLinkedUsers,
  getWrappedRun,
  getWrappedRunByShareId,
  upsertWrappedRun,
  hasWrappedRun,
  markWrappedViewed,
  readLeaderboardCache,
  writeLeaderboardCache,
  getWrappedSettings,
} from "../../controllers/wrappedController.js";

/**
 * Resolve the active Wrapped period from the editable `wrappedSettings` row
 * (set via the dashboard), falling back to the built-in rolling-12-month
 * default. Async because it reads the DB; every caller is already async.
 */
export async function getConfiguredWrappedPeriod(now = new Date()) {
  // Period is driven entirely by the dashboard (wrappedSettings). No config.json.
  let db = {};
  try {
    db = await getWrappedSettings();
  } catch {
    // settings table missing / DB down — fall back to the built-in rolling default.
  }
  return resolveWrappedPeriod(now, {
    enabled: db.enabled ?? true,
    periodStart: db.periodStart ?? null,
    periodEnd: db.periodEnd ?? null,
    rollingMonths: db.rollingMonths ?? undefined,
  });
}

export const WRAPPED_PAYLOAD_VERSION = 1;

/**
 * Crafting For Christ Wrapped — aggregation + persistence.
 *
 * Flow: pull Zander's own gameSessions stats, call MineMonitor's
 * /api/wrapped/stats endpoint for the Discord/voice/reputation numbers,
 * merge, rank each stat against every linked user for the period (via a
 * cached leaderboard context), derive the extra slides, then persist the
 * whole payload so the share link and next year's YoY slide can reuse it.
 */

// ── Leaderboard context (per period, cached) ──────────────────────────────

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Build (or read from cache) the ranking context for a period: for every
 * linked user, their value for each rankable stat. Stored as sorted-agnostic
 * `{ userId, value }[]` arrays; `rankOf` does the ordering.
 *
 * The MineMonitor fan-out is the expensive part (one request per linked
 * user), which is exactly why this is computed once per period and cached in
 * `wrappedLeaderboardCache`.
 */
export async function buildLeaderboardContext(period, { rebuild = false } = {}) {
  if (!rebuild) {
    const cached = await readLeaderboardCache(period.year);
    if (cached) return cached.data;
  }

  const start = new Date(period.start);
  const end = new Date(period.end);

  const [linkedUsers, zanderRaw] = await Promise.all([
    getLinkedUsers(),
    getZanderLeaderboardRaw(start, end),
  ]);

  // Rank only against users who were actually online/active during the period —
  // not the whole account list. "Active" = has in-game time or sessions in the
  // window (the ONLY thing that puts a user in zanderRaw).
  const activeUsers = linkedUsers.filter((u) => {
    const z = zanderRaw.get(Number(u.userId));
    return z && (z.playtimeSeconds > 0 || z.sessions > 0);
  });

  const ctx = {
    playtime: [],
    sessions: [],
    discordMessages: [],
    discordReactions: [],
    voiceMinutes: [],
    reputationLifetime: [],
  };

  const mmEnabled = isMineMonitorConfigured();

  const mmStats = mmEnabled
    ? await mapWithConcurrency(activeUsers, 6, (u) =>
        fetchWrappedStats(u.uuid, start, end).catch(() => null)
      )
    : activeUsers.map(() => null);

  activeUsers.forEach((u, i) => {
    const z = zanderRaw.get(Number(u.userId)) || { playtimeSeconds: 0, sessions: 0 };
    ctx.playtime.push({ userId: u.userId, value: z.playtimeSeconds });
    ctx.sessions.push({ userId: u.userId, value: z.sessions });

    const mm = mmStats[i];
    if (mm) {
      ctx.discordMessages.push({ userId: u.userId, value: mm.discordMessages || 0 });
      ctx.discordReactions.push({ userId: u.userId, value: mm.discordReactions || 0 });
      ctx.voiceMinutes.push({ userId: u.userId, value: Math.round((mm.voiceSeconds || 0) / 60) });
      if (mm.lifetimeReputation !== null && mm.lifetimeReputation !== undefined) {
        ctx.reputationLifetime.push({ userId: u.userId, value: mm.lifetimeReputation });
      }
    }
  });

  await writeLeaderboardCache(period.year, ctx);
  return ctx;
}

// ── Payload assembly ─────────────────────────────────────────────────────

function statBlock(value, ctxEntries, userId, extra = {}) {
  const rank = rankOf(ctxEntries, userId);
  return { value, rank: rank?.rank ?? null, total: rank?.total ?? null, ...extra };
}

/**
 * Build the full Wrapped payload for a user. Persists it as a `wrappedRuns`
 * row and returns the hydrated run — unless `opts.persist === false`, in which
 * case nothing is written and `{ payload }` is returned (used by the admin
 * preview tool).
 *
 * @param {{ userId: number, username: string, uuid: string }} user
 * @param {{ force?: boolean, period?: object, context?: object, persist?: boolean }} [opts]
 */
export async function buildWrappedPayload(user, opts = {}) {
  const period = opts.period || (await getConfiguredWrappedPeriod());
  const start = new Date(period.start);
  const end = new Date(period.end);

  const [zander, mm, context, priorRun] = await Promise.all([
    getZanderStatsForUser(user.userId, start, end),
    user.uuid ? fetchWrappedStats(user.uuid, start, end) : Promise.resolve(null),
    opts.context
      ? Promise.resolve(opts.context)
      : buildLeaderboardContext(period, { rebuild: Boolean(opts.force) }),
    getWrappedRun(user.userId, period.year - 1),
  ]);

  const discordLinked = Boolean(mm && mm.discordLinked);
  // Emit the Discord/voice slides whenever MineMonitor returned data at all —
  // don't gate on its `discordLinked` flag (MineMonitor's own link table can lag
  // Zander's). The per-value `hasVal()` check on the page hides genuine zeroes.
  const hasMM = mm !== null;
  const voiceMinutes = mm ? Math.round((mm.voiceSeconds || 0) / 60) : 0;
  const priorStats = priorRun?.payload?.stats ?? null;

  const vibe = vibeLabel({
    playtimeSeconds: zander.playtimeSeconds,
    discordMessages: mm?.discordMessages || 0,
    voiceMinutes,
    sessions: zander.sessions,
    topCommand: mm?.topCommand?.command || null,
  });

  const payload = {
    version: WRAPPED_PAYLOAD_VERSION,
    generatedAt: new Date().toISOString(),
    period: { year: period.year, label: period.label, start: start.toISOString(), end: end.toISOString() },
    user: { userId: user.userId, username: user.username, uuid: user.uuid || null },
    discordLinked,
    minemonitorAvailable: mm !== null,
    stats: {
      playtime: statBlock(zander.playtimeSeconds, context.playtime, user.userId, {
        display: humanizeDuration(zander.playtimeSeconds),
      }),
      sessions: statBlock(zander.sessions, context.sessions, user.userId),
      avgSession: {
        value: zander.avgSessionSeconds,
        display: humanizeDuration(zander.avgSessionSeconds),
      },
      tenure: { firstSeen: zander.firstSeen, days: zander.tenureDays },
      mostActiveDay: zander.mostActiveDay,
      mostActiveMonth: zander.mostActiveMonth,
      discordMessages: hasMM
        ? statBlock(mm.discordMessages || 0, context.discordMessages, user.userId)
        : null,
      discordReactions: hasMM
        ? statBlock(mm.discordReactions || 0, context.discordReactions, user.userId)
        : null,
      voiceMinutes: hasMM
        ? statBlock(voiceMinutes, context.voiceMinutes, user.userId, {
            display: humanizeDuration(voiceMinutes * 60),
          })
        : null,
      reputation:
        mm && mm.reputationLevel !== null && mm.reputationLevel !== undefined
          ? statBlock(mm.lifetimeReputation || 0, context.reputationLifetime, user.userId, {
              level: mm.reputationLevel,
              lifetime: mm.lifetimeReputation || 0,
            })
          : null,
      topCommand: mm?.topCommand || null,
      friend: mm?.topVoiceCompanion
        ? {
            name: mm.topVoiceCompanion.displayName || "a mystery friend",
            minutes: Math.round((mm.topVoiceCompanion.seconds || 0) / 60),
          }
        : null,
    },
    yoy: priorStats
      ? {
          priorYear: period.year - 1,
          playtimePct: pctChange(zander.playtimeSeconds, priorStats.playtime?.value ?? null),
          sessionsPct: pctChange(zander.sessions, priorStats.sessions?.value ?? null),
          messagesPct: hasMM
            ? pctChange(mm.discordMessages || 0, priorStats.discordMessages?.value ?? null)
            : null,
          voicePct: hasMM
            ? pctChange(voiceMinutes, priorStats.voiceMinutes?.value ?? null)
            : null,
        }
      : null,
    vibe,
  };

  if (opts.persist === false) {
    return { payload, shareId: null, preview: true };
  }

  const existing = await getWrappedRun(user.userId, period.year);

  // A generated Wrapped is frozen: once the run exists, its stats never change
  // (even if playtime, ranks or MineMonitor data move afterwards). Only an
  // explicit force rebuild — admin-only — overwrites it.
  if (existing && !opts.force) return existing;

  const shareId = existing?.shareId || generateShareId();

  return upsertWrappedRun({
    userId: user.userId,
    periodYear: period.year,
    periodStart: start,
    periodEnd: end,
    shareId,
    payload,
    force: Boolean(opts.force),
  });
}

/**
 * Build a user's Wrapped payload without persisting anything — for admin
 * testing. `period` may be an explicit resolved period (e.g. from
 * `resolveWrappedPeriod` with custom bounds) to preview a not-yet-active window.
 */
export async function buildWrappedPreview(user, { period, rebuildLeaderboard = false } = {}) {
  const resolved = period || (await getConfiguredWrappedPeriod());
  const context = rebuildLeaderboard
    ? await buildLeaderboardContext(resolved, { rebuild: true })
    : undefined;
  const { payload } = await buildWrappedPayload(user, {
    period: resolved,
    persist: false,
    context,
  });
  return payload;
}

/** Refetch MineMonitor for every linked user and rewrite the period's rank cache. */
export async function rebuildWrappedLeaderboard(period) {
  const resolved = period || (await getConfiguredWrappedPeriod());
  await buildLeaderboardContext(resolved, { rebuild: true });
  return resolved;
}

/**
 * Return this period's run for the user, building + persisting it on first
 * request (or when `force`).
 */
export async function getOrBuildWrapped(user, { force = false } = {}) {
  const period = await getConfiguredWrappedPeriod();
  if (!force) {
    const existing = await getWrappedRun(user.userId, period.year);
    if (existing) return { run: existing, period, built: false };
  }
  const run = await buildWrappedPayload(user, { force, period });
  return { run, period, built: true };
}

/**
 * Whether to show the once-per-period login prompt: inside the active
 * window, user has a linked Minecraft account, and they haven't generated
 * this period's Wrapped yet.
 */
export async function shouldPromptForWrapped(user) {
  if (!user?.userId || !user?.uuid) return false;
  const period = await getConfiguredWrappedPeriod();
  if (!period.active) return false;
  return !(await hasWrappedRun(user.userId, period.year));
}

export { getWrappedRunByShareId, markWrappedViewed };
export { resolveWrappedPeriod } from "../../lib/wrapped/period.js";
