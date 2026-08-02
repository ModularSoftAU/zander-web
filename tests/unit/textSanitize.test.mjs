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

  it("escapes markdown hyperlink syntax so a disguised link can't render", () => {
    const result = sanitizeExternalText("[Click here](https://evil.example)");
    expect(result).not.toMatch(/\[Click here\]\(https:\/\/evil\.example\)/);
    expect(result).toBe("\\[Click here\\]\\(https://evil.example\\)");
  });
});
