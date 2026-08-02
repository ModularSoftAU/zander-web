import { describe, it, expect, vi, beforeEach } from "vitest";

const { recordIpSessionMock } = vi.hoisted(() => ({
  recordIpSessionMock: vi.fn().mockResolvedValue(),
}));
vi.mock("../../controllers/ipHistoryController.js", () => ({
  recordIpSession: recordIpSessionMock,
}));
// api/routes/session.js imports `required` from api/common.js, which pulls in
// databaseController.js (requires DATABASE_URL etc. at module load). Mock it
// out so this unit test doesn't depend on a real DB connection string.
vi.mock("../../controllers/databaseController.js", () => ({ default: {}, prisma: {} }));

const dbQueryMock = vi.fn();

import sessionApiRoute from "../../api/routes/session.js";

function buildApp() {
  const routes = {};
  const app = {
    post: (path, handler) => {
      routes[path] = handler;
    },
  };
  const db = { query: dbQueryMock };
  const config = {};
  const features = {};
  const lang = { session: { newSessionCreated: "Session started for %UUID%" } };
  sessionApiRoute(app, config, db, features, lang);
  return routes;
}

function fakeRes() {
  const res = { sent: false };
  res.send = (body) => {
    res.sent = true;
    res.body = body;
    return res;
  };
  res.status = () => res;
  return res;
}

beforeEach(() => {
  recordIpSessionMock.mockClear();
  dbQueryMock.mockReset();
});

describe("POST /api/session/create", () => {
  it("normalizes and records the IP after a successful session insert", async () => {
    const routes = buildApp();
    dbQueryMock
      .mockImplementationOnce((sql, params, cb) => cb(null, [{ userId: 42 }])) // SELECT userId
      .mockImplementationOnce((sql, params, cb) => cb(null)); // INSERT gameSessions

    const req = { body: { uuid: "uuid-1", ipAddress: "203.0.113.15:54321" } };
    const res = fakeRes();

    await routes["/api/session/create"](req, res);

    expect(recordIpSessionMock).toHaveBeenCalledWith("uuid-1", "203.0.113.15");
    expect(res.body.success).toBe(true);
  });

  it("does not record IP history when the user is not found", async () => {
    const routes = buildApp();
    dbQueryMock.mockImplementationOnce((sql, params, cb) => cb(null, []));

    const req = { body: { uuid: "unknown-uuid", ipAddress: "203.0.113.15" } };
    const res = fakeRes();

    await routes["/api/session/create"](req, res);

    expect(recordIpSessionMock).not.toHaveBeenCalled();
    expect(res.body.success).toBe(false);
  });
});
