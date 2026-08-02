import { describe, it, expect, vi } from "vitest";
import { createNameHistoryLookupService } from "../../lib/discord/nameHistoryLookup.mjs";

function buildService({ mojangClient, nameMcService }) {
  return createNameHistoryLookupService({
    requestTimeoutMs: 1000,
    cacheTtlMs: 1000,
    minIntervalMs: 0,
    mojangClient,
    nameMcService,
  });
}

describe("lookupNameHistory", () => {
  it("returns invalid for a malformed username without calling either client", async () => {
    const mojangClient = { resolveUsername: vi.fn() };
    const nameMcService = { fetchPreviousNames: vi.fn() };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("bad name!");
    expect(result).toEqual({ status: "invalid" });
    expect(mojangClient.resolveUsername).not.toHaveBeenCalled();
    expect(nameMcService.fetchPreviousNames).not.toHaveBeenCalled();
  });

  it("returns not_found when Mojang has no such username", async () => {
    const mojangClient = { resolveUsername: vi.fn().mockResolvedValue({ status: "not_found" }) };
    const nameMcService = { fetchPreviousNames: vi.fn() };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("MissingPlayer");
    expect(result).toEqual({ status: "not_found" });
    expect(nameMcService.fetchPreviousNames).not.toHaveBeenCalled();
  });

  it("returns unavailable when Mojang is unavailable", async () => {
    const mojangClient = { resolveUsername: vi.fn().mockResolvedValue({ status: "unavailable" }) };
    const nameMcService = { fetchPreviousNames: vi.fn() };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("ErrorPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns found with previousNames when both steps succeed", async () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    const mojangClient = {
      resolveUsername: vi.fn().mockResolvedValue({ status: "found", uuid, currentName: "CurrentPlayer" }),
    };
    const nameMcService = {
      fetchPreviousNames: vi.fn().mockResolvedValue({
        status: "found",
        previousNames: [{ name: "OldPlayer", changedAt: new Date("2025-01-04T00:00:00Z") }],
      }),
    };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("CurrentPlayer");
    expect(result).toEqual({
      status: "found",
      currentName: "CurrentPlayer",
      uuid,
      previousNames: [{ name: "OldPlayer", changedAt: new Date("2025-01-04T00:00:00Z") }],
      profileUrl: `https://namemc.com/profile/${uuid}`,
      avatarUrl: `https://crafatar.com/avatars/${uuid}?size=128&overlay`,
    });
  });

  it("returns found with empty previousNames when NameMC has no tracked history", async () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    const mojangClient = {
      resolveUsername: vi.fn().mockResolvedValue({ status: "found", uuid, currentName: "SoloPlayer" }),
    };
    const nameMcService = { fetchPreviousNames: vi.fn().mockResolvedValue({ status: "not_found" }) };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("SoloPlayer");
    expect(result.status).toBe("found");
    expect(result.previousNames).toEqual([]);
  });

  it("collapses a Mojang success + NameMC unavailable into overall unavailable", async () => {
    const uuid = "00000000-0000-0000-0000-000000000000";
    const mojangClient = {
      resolveUsername: vi.fn().mockResolvedValue({ status: "found", uuid, currentName: "CurrentPlayer" }),
    };
    const nameMcService = { fetchPreviousNames: vi.fn().mockResolvedValue({ status: "unavailable" }) };
    const service = buildService({ mojangClient, nameMcService });
    const result = await service.lookupNameHistory("CurrentPlayer");
    expect(result).toEqual({ status: "unavailable" });
  });
});
