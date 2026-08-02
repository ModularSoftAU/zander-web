// tests/unit/nameMcCache.test.mjs
import { describe, it, expect, vi } from "vitest";
import { createNameMcCache } from "../../lib/discord/nameMcCache.mjs";

describe("getCached/setCached", () => {
  it("returns undefined for a missing key", () => {
    const cache = createNameMcCache({ cacheTtlMs: 1000, minIntervalMs: 0 });
    expect(cache.getCached("ExamplePlayer")).toBeUndefined();
  });

  it("returns a stored value before expiry, case-insensitively", () => {
    const cache = createNameMcCache({ cacheTtlMs: 10_000, minIntervalMs: 0 });
    cache.setCached("ExamplePlayer", { currentName: "ExamplePlayer" });
    expect(cache.getCached("exampleplayer")).toEqual({ currentName: "ExamplePlayer" });
  });

  it("returns undefined after expiry", async () => {
    vi.useFakeTimers();
    const cache = createNameMcCache({ cacheTtlMs: 10, minIntervalMs: 0 });
    cache.setCached("ExamplePlayer", { currentName: "ExamplePlayer" });
    vi.advanceTimersByTime(20);
    expect(cache.getCached("ExamplePlayer")).toBeUndefined();
    vi.useRealTimers();
  });
});

describe("dedupe", () => {
  it("only invokes fn once for concurrent calls with the same key", async () => {
    const cache = createNameMcCache({ cacheTtlMs: 1000, minIntervalMs: 0 });
    let calls = 0;
    const fn = () => {
      calls += 1;
      return new Promise((resolve) => setTimeout(() => resolve("done"), 10));
    };
    const [a, b] = await Promise.all([
      cache.dedupe("ExamplePlayer", fn),
      cache.dedupe("exampleplayer", fn),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe("done");
    expect(b).toBe("done");
  });

  it("invokes fn again for a subsequent call after the first resolves", async () => {
    const cache = createNameMcCache({ cacheTtlMs: 1000, minIntervalMs: 0 });
    let calls = 0;
    const fn = () => {
      calls += 1;
      return Promise.resolve("done");
    };
    await cache.dedupe("ExamplePlayer", fn);
    await cache.dedupe("ExamplePlayer", fn);
    expect(calls).toBe(2);
  });
});

describe("throttle", () => {
  it("serializes calls so each starts at least minIntervalMs after the previous", async () => {
    const cache = createNameMcCache({ cacheTtlMs: 1000, minIntervalMs: 50 });
    const starts = [];
    const fn = () => {
      starts.push(Date.now());
      return Promise.resolve();
    };
    await Promise.all([cache.throttle(fn), cache.throttle(fn), cache.throttle(fn)]);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(45);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(45);
  });
});
