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
    // Expected, deliberate configuration — not an error. Wrapped is built from
    // Zander data alone and the Discord/voice slides are simply omitted.
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

    const raw = await res.json();
    if (!raw || raw.ok === false || raw.success === false) {
      console.warn(`[WRAPPED] MineMonitor stats error body for ${uuid}:`, raw?.error || raw?.message);
      return null;
    }
    // Tolerate {..fields}, {data:{..}}, {stats:{..}} and camel/snake_case.
    const b = raw.data && typeof raw.data === "object" ? raw.data
      : raw.stats && typeof raw.stats === "object" ? raw.stats
      : raw;
    const pick = (...keys) => {
      for (const k of keys) if (b[k] !== undefined && b[k] !== null) return b[k];
      return undefined;
    };

    const parsed = {
      uuid: pick("uuid", "player_uuid", "playerUuid") ?? uuid,
      discordLinked: Boolean(pick("discordLinked", "discord_linked", "linked")),
      discordMessages: Number(pick("discordMessages", "discord_messages", "messages")) || 0,
      discordReactions: Number(pick("discordReactions", "discord_reactions", "reactions")) || 0,
      voiceSeconds:
        Number(pick("voiceSeconds", "voice_seconds")) ||
        Number(pick("voiceMinutes", "voice_minutes")) * 60 ||
        0,
      reputationLevel: pick("reputationLevel", "reputation_level", "repLevel") ?? null,
      lifetimeReputation: pick("lifetimeReputation", "lifetime_reputation", "reputation", "rep") ?? null,
      topCommand: pick("topCommand", "top_command") ?? null,
      topVoiceCompanion: pick("topVoiceCompanion", "top_voice_companion") ?? null,
    };

    console.info(
      `[WRAPPED] MineMonitor ${uuid}: linked=${parsed.discordLinked} msgs=${parsed.discordMessages} ` +
      `reacts=${parsed.discordReactions} voiceSec=${parsed.voiceSeconds} rep=${parsed.reputationLevel}`
    );
    return parsed;
  } catch (err) {
    console.warn(`[WRAPPED] MineMonitor stats fetch failed for ${uuid}:`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
