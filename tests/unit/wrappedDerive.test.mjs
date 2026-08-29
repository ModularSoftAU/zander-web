import { describe, expect, it } from "vitest";
import { resolveWrappedPeriod } from "../../lib/wrapped/period.js";
import { rankOf, pctChange, humanizeDuration, vibeLabel } from "../../lib/wrapped/derive.js";

describe("resolveWrappedPeriod", () => {
  it("defaults to a rolling 12 months ending today", () => {
    const p = resolveWrappedPeriod(new Date("2026-08-01T12:00:00Z"));
    expect(p.start.toISOString()).toBe("2025-08-01T00:00:00.000Z");
    expect(p.end.toISOString()).toBe("2026-08-01T23:59:59.999Z");
    expect(p.year).toBe(2026);
    expect(p.active).toBe(true); // rolling window is always "active" while enabled
  });

  it("honours a custom rolling length", () => {
    const p = resolveWrappedPeriod(new Date("2026-08-15T12:00:00Z"), { rollingMonths: 3 });
    expect(p.start.toISOString()).toBe("2026-05-15T00:00:00.000Z");
    expect(p.label).toBe("Last 3 months");
  });

  it("honours an MM-DD span within the current year", () => {
    const p = resolveWrappedPeriod(new Date("2025-06-15T12:00:00Z"), {
      periodStart: "06-01",
      periodEnd: "06-30",
    });
    expect(p.start.toISOString()).toBe("2025-06-01T00:00:00.000Z");
    expect(p.end.toISOString()).toBe("2025-06-30T23:59:59.999Z");
    expect(p.active).toBe(true);
  });

  it("honours exact YYYY-MM-DD bounds", () => {
    const p = resolveWrappedPeriod(new Date("2026-01-01T12:00:00Z"), {
      periodStart: "2024-09-01",
      periodEnd: "2025-09-01",
    });
    expect(p.start.toISOString()).toBe("2024-09-01T00:00:00.000Z");
    expect(p.end.toISOString()).toBe("2025-09-01T23:59:59.999Z");
    expect(p.year).toBe(2025);
    expect(p.active).toBe(false); // now is past the fixed end
  });

  it("respects the enabled flag", () => {
    expect(resolveWrappedPeriod(new Date(), { enabled: false }).active).toBe(false);
  });
});

describe("rankOf", () => {
  const entries = [
    { userId: 1, value: 100 },
    { userId: 2, value: 300 },
    { userId: 3, value: 200 },
  ];
  it("ranks highest value as #1", () => {
    expect(rankOf(entries, 2)).toEqual({ rank: 1, total: 3 });
    expect(rankOf(entries, 3)).toEqual({ rank: 2, total: 3 });
    expect(rankOf(entries, 1)).toEqual({ rank: 3, total: 3 });
  });
  it("returns null for unknown user or empty set", () => {
    expect(rankOf(entries, 99)).toBeNull();
    expect(rankOf([], 1)).toBeNull();
  });
});

describe("pctChange", () => {
  it("computes rounded percent change", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(75, 100)).toBe(-25);
  });
  it("returns null without a usable baseline", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(100, null)).toBeNull();
  });
});

describe("humanizeDuration", () => {
  it("formats seconds into h/m", () => {
    expect(humanizeDuration(0)).toBe("no time at all");
    expect(humanizeDuration(90)).toBe("1m");
    expect(humanizeDuration(3660)).toBe("1h 1m");
    expect(humanizeDuration(7200)).toBe("2h");
  });
});

describe("vibeLabel", () => {
  it("labels a high-playtime, high-message player a Chatty Grinder", () => {
    const v = vibeLabel({ playtimeSeconds: 400 * 3600, discordMessages: 900, voiceMinutes: 30, sessions: 200 });
    expect(v.label).toBe("Chatty Grinder");
  });
  it("labels a light player a Weekend Visitor", () => {
    const v = vibeLabel({ playtimeSeconds: 5 * 3600, discordMessages: 10, voiceMinutes: 0, sessions: 4 });
    expect(v.label).toBe("Weekend Visitor");
  });
  it("always returns a label and blurb", () => {
    const v = vibeLabel({ playtimeSeconds: 40 * 3600, discordMessages: 100, voiceMinutes: 120, sessions: 50 });
    expect(typeof v.label).toBe("string");
    expect(typeof v.blurb).toBe("string");
  });
});
