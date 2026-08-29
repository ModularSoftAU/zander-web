import { describe, expect, it } from "vitest";
import { renderWrappedCard } from "../../lib/wrapped/card.js";

const payload = {
  period: { year: 2025, label: "2025" },
  user: { username: "Ben<>&", uuid: "u" },
  stats: {
    playtime: { display: "142h", value: 511200 },
    sessions: { value: 88 },
    discordMessages: { value: 412 },
    voiceMinutes: { display: "3h 56m" },
    reputation: { level: 7 },
    topCommand: { command: "/spawn" },
  },
  vibe: { label: "Chatty Grinder" },
};

describe("renderWrappedCard", () => {
  it("produces a 1200x630 svg with the username and stats", () => {
    const svg = renderWrappedCard(payload);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain("142h");
    expect(svg).toContain("/spawn");
    expect(svg).toContain("Chatty Grinder");
  });

  it("escapes user-controlled text", () => {
    const svg = renderWrappedCard(payload);
    expect(svg).toContain("Ben&lt;&gt;&amp;");
    expect(svg).not.toContain("Ben<>&");
  });

  it("tolerates a sparse payload", () => {
    const svg = renderWrappedCard({ period: { label: "2024" }, user: {}, stats: {} });
    expect(svg).toContain("Player");
    expect(svg).toContain("—");
  });
});
