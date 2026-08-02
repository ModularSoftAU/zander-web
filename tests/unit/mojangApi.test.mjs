import { describe, it, expect, vi } from "vitest";
import { isValidUsername, getAvatarUrl, createMojangApiClient } from "../../lib/discord/mojangApi.mjs";

describe("isValidUsername", () => {
  it("accepts a valid username", () => {
    expect(isValidUsername("ExamplePlayer")).toBe(true);
  });
  it("rejects a username shorter than 3 chars", () => {
    expect(isValidUsername("ab")).toBe(false);
  });
  it("rejects a username with invalid characters", () => {
    expect(isValidUsername("bad name!")).toBe(false);
  });
  it("rejects a username longer than 16 chars", () => {
    expect(isValidUsername("a".repeat(17))).toBe(false);
  });
});

describe("getAvatarUrl", () => {
  it("builds a Crafatar URL from a UUID with no network call", () => {
    expect(getAvatarUrl("00000000-0000-0000-0000-000000000000")).toBe(
      "https://crafatar.com/avatars/00000000-0000-0000-0000-000000000000?size=128&overlay"
    );
  });
});

describe("resolveUsername", () => {
  it("resolves a valid username to a dashed uuid and current name", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "00000000000000000000000000000000", name: "CurrentPlayer" }),
    });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("CurrentPlayer");
    expect(result).toEqual({
      status: "found",
      uuid: "00000000-0000-0000-0000-000000000000",
      currentName: "CurrentPlayer",
    });
  });

  it("returns not_found for a 204 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 204, json: async () => ({}) });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("MissingPlayer");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a 404 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("MissingPlayer");
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns unavailable on a non-404/204 error status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("ErrorPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable on 429", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("RateLimitedPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when fetch throws (e.g. timeout)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("timeout"));
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("TimeoutPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when the JSON body is malformed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
    });
    const client = createMojangApiClient({ requestTimeoutMs: 1000, fetchImpl });
    const result = await client.resolveUsername("BrokenPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });
});
