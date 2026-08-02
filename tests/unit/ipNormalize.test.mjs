import { describe, it, expect } from "vitest";
import { normalizeIp } from "../../lib/discord/ipNormalize.mjs";

describe("normalizeIp", () => {
  it("passes through a plain IPv4 address", () => {
    expect(normalizeIp("203.0.113.15")).toBe("203.0.113.15");
  });

  it("strips a leading slash", () => {
    expect(normalizeIp("/203.0.113.15")).toBe("203.0.113.15");
  });

  it("strips a trailing port from IPv4", () => {
    expect(normalizeIp("203.0.113.15:54321")).toBe("203.0.113.15");
  });

  it("passes through a plain IPv6 address in lowercase", () => {
    expect(normalizeIp("2001:DB8::1")).toBe("2001:db8::1");
  });

  it("strips brackets and port from IPv6", () => {
    expect(normalizeIp("[2001:db8::1]:54321")).toBe("2001:db8::1");
  });

  it("normalizes an IPv4-mapped IPv6 address to plain IPv4", () => {
    expect(normalizeIp("::ffff:203.0.113.15")).toBe("203.0.113.15");
  });

  it("throws on malformed input", () => {
    expect(() => normalizeIp("not-an-ip")).toThrow("Invalid IP address");
  });

  it("throws on empty input", () => {
    expect(() => normalizeIp("")).toThrow("Invalid IP address");
  });
});
