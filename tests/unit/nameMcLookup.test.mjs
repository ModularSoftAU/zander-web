import { describe, it, expect, vi } from "vitest";
import { createNameMcPreviousNamesService } from "../../lib/discord/nameMcLookup.mjs";

const PROFILE_HTML_MULTIPLE_NAMES = `
<html><body>
  <h1 class="mb-0">CurrentPlayer</h1>
  <div class="card-header">Name History</div>
  <div class="card-body">
    <div class="name-change-row" data-name="OriginalPlayer" data-changed-at="2025-01-04T00:00:00Z"></div>
    <div class="name-change-row" data-name="SecondPlayer" data-changed-at="2026-03-18T00:00:00Z"></div>
  </div>
</body></html>
`;

const PROFILE_HTML_NO_HISTORY = `
<html><body>
  <h1 class="mb-0">SoloPlayer</h1>
  <div class="card-header">Name History</div>
  <div class="card-body"></div>
</body></html>
`;

function fakeFetch(responses) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[call];
    call += 1;
    return r;
  });
}

const UUID = "00000000-0000-0000-0000-000000000000";

describe("fetchPreviousNames", () => {
  it("parses a profile with multiple previous names", async () => {
    const fetchImpl = fakeFetch([{ ok: true, status: 200, text: async () => PROFILE_HTML_MULTIPLE_NAMES }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({
      status: "found",
      previousNames: [
        { name: "OriginalPlayer", changedAt: new Date("2025-01-04T00:00:00Z") },
        { name: "SecondPlayer", changedAt: new Date("2026-03-18T00:00:00Z") },
      ],
    });
  });

  it("parses a profile with no previous names", async () => {
    const fetchImpl = fakeFetch([{ ok: true, status: 200, text: async () => PROFILE_HTML_NO_HISTORY }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "found", previousNames: [] });
  });

  it("returns not_found for a 404 response", async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 404, text: async () => "" }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns unavailable on a non-404 error status", async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 500, text: async () => "" }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable on 429", async () => {
    const fetchImpl = fakeFetch([{ ok: false, status: 429, text: async () => "" }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when fetch throws (e.g. timeout)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("timeout"));
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 1000, minIntervalMs: 0, fetchImpl });
    const result = await service.fetchPreviousNames(UUID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("caches a found result and does not call fetch again for the same uuid", async () => {
    const fetchImpl = fakeFetch([{ ok: true, status: 200, text: async () => PROFILE_HTML_NO_HISTORY }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 60_000, minIntervalMs: 0, fetchImpl });
    await service.fetchPreviousNames(UUID);
    const second = await service.fetchPreviousNames(UUID);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second.status).toBe("found");
  });

  it("deduplicates concurrent lookups for the same uuid", async () => {
    const fetchImpl = fakeFetch([{ ok: true, status: 200, text: async () => PROFILE_HTML_NO_HISTORY }]);
    const service = createNameMcPreviousNamesService({ requestTimeoutMs: 1000, cacheTtlMs: 60_000, minIntervalMs: 0, fetchImpl });
    const [a, b] = await Promise.all([
      service.fetchPreviousNames(UUID),
      service.fetchPreviousNames(UUID.toUpperCase()),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a.status).toBe("found");
    expect(b.status).toBe("found");
  });
});
