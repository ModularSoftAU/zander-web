/**
 * Pure derivation helpers for Wrapped — ranking, year-over-year deltas,
 * humanised durations, and the closing "vibe" label. No DB or network here
 * so this stays unit-testable and tunable.
 */

/**
 * 1-indexed rank of `userId` within `entries` (higher value = better rank).
 * @param {Array<{ userId: number, value: number }>} entries
 * @param {number} userId
 * @returns {{ rank: number, total: number } | null}
 */
export function rankOf(entries, userId) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const idx = sorted.findIndex((e) => Number(e.userId) === Number(userId));
  if (idx === -1) return null;
  return { rank: idx + 1, total: sorted.length };
}

/**
 * Percent change from `prior` → `current`. Null when there's no usable
 * baseline (missing prior run, or prior value of 0).
 */
export function pctChange(current, prior) {
  if (prior === null || prior === undefined || !Number.isFinite(prior) || prior === 0) return null;
  if (current === null || current === undefined || !Number.isFinite(current)) return null;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

export function humanizeDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s === 0) return "no time at all";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1 && m >= 1) return `${h}h ${m}m`;
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}m`;
  return `${s}s`;
}

/**
 * Rule-based personality label from the computed stats. Deliberately simple
 * threshold logic — tweak the numbers here, not a model.
 *
 * @param {{
 *   playtimeSeconds: number,
 *   discordMessages: number,
 *   voiceMinutes: number,
 *   sessions: number,
 *   topCommand: string | null,
 *   nightSessionRatio?: number
 * }} s
 */
export function vibeLabel(s) {
  const hours = (s.playtimeSeconds || 0) / 3600;
  const msgs = s.discordMessages || 0;
  const voice = s.voiceMinutes || 0;
  const sessions = s.sessions || 0;

  const chatty = msgs >= 500;
  const talker = voice >= 600; // 10h+ in voice
  const grinder = hours >= 100;
  const dabbler = hours < 10 && sessions < 10;
  const social = chatty || talker;

  let label;
  let blurb;

  if (grinder && chatty) {
    label = "Chatty Grinder";
    blurb = "You put in the hours and never stopped talking about it.";
  } else if (grinder && talker) {
    label = "Voice-Chat Marathoner";
    blurb = "Hundreds of hours in-game, most of them with friends in your ear.";
  } else if (grinder) {
    label = "Quiet Grinder";
    blurb = "Head down, blocks placed, work done.";
  } else if (talker) {
    label = "Campfire Regular";
    blurb = "The voice channel wasn't the same without you.";
  } else if (chatty) {
    label = "Server Chatterbox";
    blurb = "If something happened, you had something to say about it.";
  } else if (social) {
    label = "Community Butterfly";
    blurb = "You showed up for the people as much as the game.";
  } else if (dabbler) {
    label = "Weekend Visitor";
    blurb = "You dropped by, said hi, and kept it light this year.";
  } else {
    label = "Steady Builder";
    blurb = "A reliable presence — a little bit of everything, all year long.";
  }

  return { label, blurb };
}
