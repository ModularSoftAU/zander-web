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

const { resolveOtherAccountsForIp, assembleUsernameResult } = await import(
  "../../commands/ipcheck.mjs"
);

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
  it("attaches otherAccounts to each IP record and includes current status", async () => {
    getIpHistoryByUuidMock.mockResolvedValue([
      { ip_address: "203.0.113.15", first_seen_at: new Date(), last_seen_at: new Date(), session_count: 24 },
    ]);
    getAccountsByIpMock.mockResolvedValue([
      { uuid: "uuid-1", username: "ExamplePlayer" },
      { uuid: "uuid-2", username: "SecondPlayer" },
    ]);
    getCurrentStatusMock.mockResolvedValue({ online: true, server: "survival" });

    const result = await assembleUsernameResult({ uuid: "uuid-1", username: "ExamplePlayer" });

    expect(result.status).toEqual({ online: true, server: "survival" });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].otherAccounts).toEqual(["SecondPlayer"]);
  });
});
