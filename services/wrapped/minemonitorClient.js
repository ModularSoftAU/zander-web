import { createRequire } from "module";

const require = createRequire(import.meta.url);

/**
 * Thin client for MineMonitor's read-only Wrapped stats endpoint
 * (`GET /api/wrapped/stats/:uuid?start=&end=`).
 *
 * Config:
 *   - config.json → `wrapped.minemonitor.baseUrl`  (e.g. "https://monitor.craftingforchrist.net")
 *   - .env        → `MINEMONITOR_CONNECTION_TOKEN`  (a MineMonitor "Connections"
 *                                                    token with the `wrapped.read` scope)
 *
 * The endpoint is token-only and internal. If it's unreachable or
 * misconfigured we degrade gracefully: callers get `null` and the Wrapped
 * payload is built from Zander data alone (Discord slides omitted).
 */

function getConfig() {
  let baseUrl = null;
  try {
    const config = require("../../config.json");
    baseUrl = config?.wrapped?.minemonitor?.baseUrl ?? null;
  } catch {
    /* config.json absent */
  }
  const token =
    process.env.MINEMONITOR_CONNECTION_TOKEN || process.env.MINEMONITOR_API_KEY || null;
  return { baseUrl, token };
}

export function isMineMonitorConfigured() {
  const { baseUrl, token } = getConfig();
  return Boolean(baseUrl && token);
}

/**
 * @param {string} uuid  dashed Minecraft UUID
 * @param {Date} start
 * @param {Date} end
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<null | {
 *   uuid: string,
 *   discordLinked: boolean,
 *   discordMessages: number,
 *   discordReactions: number,
 *   voiceSeconds: number,
 *   reputationLevel: number | null,
 *   lifetimeReputation: number | null,
 *   topCommand: { command: string, count: number } | null,
 *   topVoiceCompanion: { discordUserId: string, displayName: string | null, seconds: number } | null
 * }>}
 */
export async function fetchWrappedStats(uuid, start, end, opts = {}) {
  const { baseUrl, token } = getConfig();
  if (!baseUrl || !token) {
    console.warn("[WRAPPED] MineMonitor not configured — skipping Discord/voice stats");
    return null;
  }
  if (!uuid) return null;

  const url =
    `${baseUrl.replace(/\/+$/, "")}/api/wrapped/stats/${encodeURIComponent(uuid)}` +
    `?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[WRAPPED] MineMonitor stats ${res.status} for ${uuid}`);
      return null;
    }

    const body = await res.json();
    if (!body || body.ok === false) {
      console.warn(`[WRAPPED] MineMonitor stats error body for ${uuid}:`, body?.error);
      return null;
    }

    return {
      uuid: body.uuid ?? uuid,
      discordLinked: Boolean(body.discordLinked),
      discordMessages: Number(body.discordMessages) || 0,
      discordReactions: Number(body.discordReactions) || 0,
      voiceSeconds: Number(body.voiceSeconds) || 0,
      reputationLevel: body.reputationLevel ?? null,
      lifetimeReputation: body.lifetimeReputation ?? null,
      topCommand: body.topCommand ?? null,
      topVoiceCompanion: body.topVoiceCompanion ?? null,
    };
  } catch (err) {
    console.warn(`[WRAPPED] MineMonitor stats fetch failed for ${uuid}:`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
