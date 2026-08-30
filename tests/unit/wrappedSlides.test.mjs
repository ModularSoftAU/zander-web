import { describe, expect, it } from "vitest";
import { buildWrappedSlides } from "../../lib/wrapped/slides.js";
import { renderWrappedSlideCard, SLIDE_CARD_W, SLIDE_CARD_H } from "../../lib/wrapped/slideCard.js";

const richPayload = {
  period: { year: 2025, label: "2025", start: "2025-01-01", end: "2025-12-31" },
  user: { userId: 7, username: "Zephyr", uuid: "u-7" },
  vibe: { label: "Chatty Grinder", blurb: "You put in the hours." },
  stats: {
    playtime: {
      value: 3600 * 40, display: "40h", rank: 3, total: 20,
      neighbors: {
        rank: 3, total: 20,
        rows: [
          { rank: 2, name: "Alex", value: 3600 * 50, you: false },
          { rank: 3, name: "You", value: 3600 * 40, you: true },
          { rank: 4, name: "Sam", value: 3600 * 30, you: false },
        ],
      },
    },
    sessions: { value: 12, rank: 5, total: 20 },
    avgSession: { value: 1200, display: "20m" },
    tenure: { firstSeen: "2023-02-01", days: 800 },
    mostActiveDay: { date: "2025-06-14", seconds: 7200 },
    mostActiveMonth: { month: "2025-06", seconds: 90000 },
    discordMessages: {
      value: 300, rank: 1, total: 15,
      neighbors: {
        rank: 1, total: 15,
        rows: [
          { rank: 1, name: "You", value: 300, you: true },
          { rank: 2, name: "Jamie", value: 250, you: false },
        ],
      },
    },
    discordReactions: { value: 88, rank: 4, total: 15 },
    voiceMinutes: { value: 120, display: "2h", rank: 2, total: 10 },
    reputation: { value: 900, level: 7, lifetime: 3120, rank: 6, total: 30 },
    topCommand: { command: "/spawn", count: 42 },
    friend: { name: "Robin", minutes: 55 },
    ingameFriend: { name: "Casey", minutes: 130 },
  },
};

describe("buildWrappedslides", () => {
  it("opens with the title slide and closes with the vibe slide", () => {
    const slides = buildWrappedSlides(richPayload);
    expect(slides[0]).toMatchObject({ key: "intro", kind: "title" });
    expect(slides[slides.length - 1]).toMatchObject({ key: "vibe", kind: "vibe", label: "Chatty Grinder" });
  });

  it("emits every stat slide and places each board right after its stat", () => {
    const keys = buildWrappedSlides(richPayload).map((s) => s.key);
    expect(keys).toEqual([
      "intro",
      "playtime", "playtimeBoard",
      "sessions",
      "tenure",
      "mostActiveDay",
      "mostActiveMonth",
      "discordMessages", "messagesBoard",
      "discordReactions",
      "voiceMinutes",
      "reputation",
      "topCommand",
      "friend",
      "ingameFriend",
      "vibe",
    ]);
  });

  it("pre-formats board row values and rank lines", () => {
    const board = buildWrappedSlides(richPayload).find((s) => s.key === "playtimeBoard");
    expect(board.neighbors.rows.map((r) => r.displayValue)).toEqual(["50h 0m", "40h 0m", "30h 0m"]);
    const playtime = buildWrappedSlides(richPayload).find((s) => s.key === "playtime");
    expect(playtime.rank).toBe("You're #3 of 20 players");
  });

  it("drops a board when there is no neighbourhood, and hides zero-value stats", () => {
    const slim = {
      period: richPayload.period,
      user: richPayload.user,
      vibe: richPayload.vibe,
      stats: { playtime: { value: 3600, display: "1h", rank: 9, total: 9 }, discordMessages: { value: 0 } },
    };
    const keys = buildWrappedSlides(slim).map((s) => s.key);
    expect(keys).toEqual(["intro", "playtime", "vibe"]);
  });

  it("falls back to a 'still being written' slide when nothing qualifies", () => {
    const keys = buildWrappedSlides({ period: richPayload.period, user: richPayload.user, stats: {} }).map((s) => s.key);
    expect(keys).toEqual(["intro", "empty", "vibe"]);
  });
});

describe("renderWrappedSlideCard", () => {
  const ctx = { user: richPayload.user, period: richPayload.period, siteName: "Crafting For Christ" };

  it("renders a 1080x1920 SVG for every slide kind", () => {
    for (const slide of buildWrappedSlides(richPayload)) {
      const svg = renderWrappedSlideCard(slide, ctx);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain(`width="${SLIDE_CARD_W}"`);
      expect(svg).toContain(`height="${SLIDE_CARD_H}"`);
      expect(svg).toContain("Wrapped 2025");
    }
  });

  it("escapes user-controlled text", () => {
    const slide = { kind: "stat", mood: "pop", emoji: "💬", flavor: "You and <script>x</script>", stat: "1 & 2" };
    const svg = renderWrappedSlideCard(slide, ctx);
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>x</script>");
    expect(svg).toContain("1 &amp; 2");
  });
});
