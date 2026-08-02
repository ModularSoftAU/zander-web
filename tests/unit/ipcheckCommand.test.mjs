import { describe, it, expect, vi, beforeEach } from "vitest";

const getAccountsByIpMock = vi.fn();
const getIpHistoryByUuidMock = vi.fn();
const getCurrentStatusMock = vi.fn();

vi.mock("../../controllers/ipHistoryController.js", () => ({
  getAccountsByIp: getAccountsByIpMock,
  getIpHistoryByUuid: getIpHistoryByUuidMock,
  getCurrentStatus: getCurrentStatusMock,
}));

// commands/ipcheck.mjs also imports controllers/userController.js and
// controllers/ipCheckAuditController.js, both of which import
// controllers/databaseController.js at module load time. That module
// constructs `new URL(process.env.DATABASE_URL)` at import time, which
// throws in local/CI environments that don't define DATABASE_URL. Since
// this test only exercises the two pure/async helper functions (not
// chatInputRun), these two modules are stubbed out so importing
// commands/ipcheck.mjs never reaches the real databaseController.js.
vi.mock("../../controllers/userController.js", () => ({
  getUserPermissions: vi.fn(),
  UserGetter: vi.fn(),
}));
vi.mock("../../controllers/ipCheckAuditController.js", () => ({
  recordAuditLog: vi.fn(),
  sendAuditEmbed: vi.fn(),
}));

const { resolveOtherAccountsForIp, assembleUsernameResult, enrichUsernameRecords, assembleIpResult, enrichIpRecords } =
  await import("../../commands/ipcheck.mjs");

beforeEach(() => {
  getAccountsByIpMock.mockReset();
  getIpHistoryByUuidMock.mockReset();
  getCurrentStatusMock.mockReset();
});

describe("resolveOtherAccountsForIp", () => {
  it("excludes the current uuid from the shared-account list", async () => {
    getAccountsByIpMock.mockResolvedValue([
      { uuid: "uuid-1", username: "ExamplePlayer" },
      { uuid: "uuid-2", username: "SecondPlayer" },
      { uuid: "uuid-3", username: "ThirdPlayer" },
    ]);
    const result = await resolveOtherAccountsForIp("203.0.113.15", "uuid-1");
    expect(result).toEqual(["SecondPlayer", "ThirdPlayer"]);
  });
});

describe("assembleUsernameResult", () => {
  it("returns raw IP history records and current status WITHOUT the per-record otherAccounts fan-out", async () => {
    getIpHistoryByUuidMock.mockResolvedValue([
      { ip_address: "203.0.113.15", first_seen_at: new Date(), last_seen_at: new Date(), session_count: 24 },
    ]);
    getCurrentStatusMock.mockResolvedValue({ online: true, server: "survival" });

    const result = await assembleUsernameResult({ uuid: "uuid-1", username: "ExamplePlayer" });

    expect(result.status).toEqual({ online: true, server: "survival" });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].otherAccounts).toBeUndefined();
    // The expensive fan-out (getAccountsByIp per record) must not have run
    // eagerly for the whole result set.
    expect(getAccountsByIpMock).not.toHaveBeenCalled();
  });
});

describe("enrichUsernameRecords", () => {
  it("attaches otherAccounts to each given record, excluding the current uuid", async () => {
    getAccountsByIpMock.mockResolvedValue([
      { uuid: "uuid-1", username: "ExamplePlayer" },
      { uuid: "uuid-2", username: "SecondPlayer" },
    ]);

    const enriched = await enrichUsernameRecords(
      [{ ip_address: "203.0.113.15", first_seen_at: new Date(), last_seen_at: new Date(), session_count: 24 }],
      "uuid-1"
    );

    expect(enriched).toHaveLength(1);
    expect(enriched[0].otherAccounts).toEqual(["SecondPlayer"]);
  });

  it("only enriches the records it's given, not a wider set (per-page fan-out bound)", async () => {
    getAccountsByIpMock.mockResolvedValue([{ uuid: "uuid-2", username: "SecondPlayer" }]);

    const records = [
      { ip_address: "203.0.113.15", first_seen_at: new Date(), last_seen_at: new Date(), session_count: 1 },
    ];
    await enrichUsernameRecords(records, "uuid-1");

    expect(getAccountsByIpMock).toHaveBeenCalledTimes(1);
  });
});

describe("assembleIpResult", () => {
  it("returns raw accounts WITHOUT the per-account status fan-out", async () => {
    getAccountsByIpMock.mockResolvedValue([{ uuid: "uuid-1", username: "ExamplePlayer" }]);

    const records = await assembleIpResult("203.0.113.15");

    expect(records).toEqual([{ uuid: "uuid-1", username: "ExamplePlayer" }]);
    expect(getCurrentStatusMock).not.toHaveBeenCalled();
  });
});

describe("enrichIpRecords", () => {
  it("attaches current status to each given record", async () => {
    getCurrentStatusMock.mockResolvedValue({ online: false, server: null });

    const enriched = await enrichIpRecords([{ uuid: "uuid-1", username: "ExamplePlayer" }]);

    expect(enriched).toEqual([{ uuid: "uuid-1", username: "ExamplePlayer", status: { online: false, server: null } }]);
  });
});
