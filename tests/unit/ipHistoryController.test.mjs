import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../../controllers/databaseController.js", () => ({
  default: { query: queryMock },
}));

const {
  recordIpSession,
  getIpHistoryByUuid,
  getAccountsByIp,
  getCurrentStatus,
} = await import("../../controllers/ipHistoryController.js");

beforeEach(() => {
  queryMock.mockReset();
});

describe("recordIpSession", () => {
  it("upserts uuid + ip_address into player_ip_history", async () => {
    queryMock.mockImplementation((sql, params, cb) => cb(null, { affectedRows: 1 }));
    await recordIpSession("uuid-1", "203.0.113.15");
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO player_ip_history/i);
    expect(sql).toMatch(/ON DUPLICATE KEY UPDATE/i);
    expect(params).toEqual(["uuid-1", "203.0.113.15"]);
  });

  it("rejects when the query errors", async () => {
    queryMock.mockImplementation((sql, params, cb) => cb(new Error("db down")));
    await expect(recordIpSession("uuid-1", "203.0.113.15")).rejects.toThrow("db down");
  });
});

describe("getIpHistoryByUuid", () => {
  it("returns rows for the given uuid", async () => {
    const rows = [{ ip_address: "203.0.113.15", first_seen_at: new Date(), last_seen_at: new Date(), session_count: 3 }];
    queryMock.mockImplementation((sql, params, cb) => cb(null, rows));
    const result = await getIpHistoryByUuid("uuid-1");
    expect(result).toBe(rows);
    expect(queryMock.mock.calls[0][1]).toEqual(["uuid-1"]);
  });
});

describe("getAccountsByIp", () => {
  it("returns joined uuid/username rows for the given ip", async () => {
    const rows = [{ uuid: "uuid-1", username: "ExamplePlayer", first_seen_at: new Date(), last_seen_at: new Date(), session_count: 3 }];
    queryMock.mockImplementation((sql, params, cb) => cb(null, rows));
    const result = await getAccountsByIp("203.0.113.15");
    expect(result).toBe(rows);
    expect(queryMock.mock.calls[0][0]).toMatch(/JOIN users/i);
    expect(queryMock.mock.calls[0][1]).toEqual(["203.0.113.15"]);
  });
});

describe("getCurrentStatus", () => {
  it("reports online with a server when an open session exists", async () => {
    queryMock.mockImplementation((sql, params, cb) => cb(null, [{ server: "survival" }]));
    const result = await getCurrentStatus("uuid-1");
    expect(result).toEqual({ online: true, server: "survival" });
  });

  it("reports offline when no open session exists", async () => {
    queryMock.mockImplementation((sql, params, cb) => cb(null, []));
    const result = await getCurrentStatus("uuid-1");
    expect(result).toEqual({ online: false, server: null });
  });
});
