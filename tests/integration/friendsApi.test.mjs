import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Token-API tests for api/routes/friends.js: endpoint registration, the
 * actor-UUID rate limits (which replace the request-IP limiter here), and that
 * limiting is keyed per actor UUID rather than globally.
 */

const friendCtl = {
  FriendActionError: class extends Error {
    constructor(m, code) {
      super(m);
      this.code = code;
    }
  },
  sendFriendRequest: vi.fn().mockResolvedValue({ status: "pending" }),
  acceptFriendRequest: vi.fn().mockResolvedValue({ ok: true }),
  declineFriendRequest: vi.fn().mockResolvedValue({ ok: true }),
  removeFriend: vi.fn().mockResolvedValue({ ok: true }),
  blockUser: vi.fn().mockResolvedValue({ ok: true, created: true }),
  unblockUser: vi.fn().mockResolvedValue({ ok: true }),
  getFriends: vi.fn().mockResolvedValue([]),
  getBlocks: vi.fn().mockResolvedValue([]),
  getPendingIncoming: vi.fn().mockResolvedValue([]),
  getPendingOutgoing: vi.fn().mockResolvedValue([]),
  getUndeliveredRequests: vi.fn().mockResolvedValue([]),
  markRequestsDelivered: vi.fn().mockResolvedValue(0),
  getOnlineFriends: vi.fn().mockResolvedValue([]),
  getPrivacySettings: vi.fn().mockResolvedValue({ allowMessagesFrom: "everyone" }),
  setPrivacySettings: vi.fn().mockResolvedValue({}),
};
vi.mock("../../controllers/friendController.js", () => friendCtl);

const friendsApiRoute = (await import("../../api/routes/friends.js")).default;

// Fake mysql2 pool: uuid -> user row.
const usersByUuid = {
  "uuid-actor": { userId: 1, username: "actor", is_placeholder: 0, account_disabled: 0 },
  "uuid-other": { userId: 2, username: "other", is_placeholder: 0, account_disabled: 0 },
  "uuid-self": { userId: 1, username: "actor", is_placeholder: 0, account_disabled: 0 },
  "uuid-v1": { userId: 3, username: "v1", is_placeholder: 0, account_disabled: 0 },
  "uuid-v2": { userId: 4, username: "v2", is_placeholder: 0, account_disabled: 0 },
};
const usersByName = {
  target: { userId: 9, username: "target", is_placeholder: 0, account_disabled: 0 },
  actor: usersByUuid["uuid-actor"],
};
const db = {
  query: (sql, params, cb) => {
    if (sql.includes("WHERE uuid = ?")) return cb(null, [usersByUuid[params[0]]].filter(Boolean));
    if (sql.includes("WHERE username = ?")) return cb(null, [usersByName[params[0]]].filter(Boolean));
    return cb(null, []);
  },
};

function build() {
  const routes = new Map();
  const app = {
    get: (p, h) => routes.set(`GET ${p}`, h),
    post: (p, h) => routes.set(`POST ${p}`, h),
    patch: (p, h) => routes.set(`PATCH ${p}`, h),
  };
  friendsApiRoute(app, {}, db, { friends: true }, {});
  return routes;
}

function makeRes() {
  return {
    sent: false,
    statusCode: 200,
    payload: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    send(p) {
      this.sent = true;
      this.payload = p;
      return this;
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("endpoint registration", () => {
  it("registers every documented endpoint", () => {
    const routes = build();
    for (const key of [
      "POST /api/friends/request",
      "POST /api/friends/accept",
      "POST /api/friends/decline",
      "POST /api/friends/remove",
      "GET /api/friends/list",
      "GET /api/friends/pending",
      "POST /api/friends/delivered",
      "GET /api/friends/online",
      "POST /api/blocks/add",
      "POST /api/blocks/remove",
      "GET /api/blocks/list",
      "GET /api/settings",
      "PATCH /api/settings",
    ]) {
      expect(routes.has(key), key).toBe(true);
    }
  });
});

describe("actor-UUID rate limiting", () => {
  it("allows 10 friend requests per hour then 429s the 11th, per actor UUID", async () => {
    const handler = build().get("POST /api/friends/request");
    const uniqueUuid = `uuid-actor`; // resolved via fake db

    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await handler({ body: { uuid: uniqueUuid, targetName: "target" } }, res);
      expect(res.statusCode, `call ${i + 1}`).toBe(200);
      expect(res.payload.success).toBe(true);
    }

    const res11 = makeRes();
    await handler({ body: { uuid: uniqueUuid, targetName: "target" } }, res11);
    expect(res11.statusCode).toBe(429);
    expect(friendCtl.sendFriendRequest).toHaveBeenCalledTimes(10);
  });

  it("keys the limit per actor UUID — a different UUID is unaffected", async () => {
    const handler = build().get("POST /api/friends/request");

    for (let i = 0; i < 11; i++) {
      await handler({ body: { uuid: "uuid-actor", targetName: "target" } }, makeRes());
    }
    const other = makeRes();
    await handler({ body: { uuid: "uuid-other", targetName: "target" } }, other);
    expect(other.statusCode).toBe(200);
    expect(other.payload.success).toBe(true);
  });

  it("allows 30 blocks per day then 429s the 31st", async () => {
    const handler = build().get("POST /api/blocks/add");
    for (let i = 0; i < 30; i++) {
      const res = makeRes();
      await handler({ body: { uuid: "uuid-other", targetName: "target" } }, res);
      expect(res.statusCode, `block ${i + 1}`).toBe(200);
    }
    const res31 = makeRes();
    await handler({ body: { uuid: "uuid-other", targetName: "target" } }, res31);
    expect(res31.statusCode).toBe(429);
  });
});

describe("self-action + validation", () => {
  it("rejects a self request by resolved name even from a different UUID field", async () => {
    const handler = build().get("POST /api/friends/request");
    const res = makeRes();
    await handler({ body: { uuid: "uuid-self", targetName: "actor" } }, res);
    expect(res.payload).toEqual({
      success: false,
      message: "You cannot do that to yourself.",
    });
    expect(friendCtl.sendFriendRequest).not.toHaveBeenCalled();
  });

  it("requires targetName", async () => {
    const handler = build().get("POST /api/friends/request");
    const res = makeRes();
    await handler({ body: { uuid: "uuid-v1" } }, res);
    expect(res.payload.success).toBe(false);
  });

  it("passes source 'game' through to the controller", async () => {
    const handler = build().get("POST /api/friends/request");
    await handler({ body: { uuid: "uuid-v2", targetName: "target" } }, makeRes());
    expect(friendCtl.sendFriendRequest).toHaveBeenCalledWith(4, 9, {
      source: "game",
      message: null,
    });
  });
});

describe("feature flag", () => {
  it("404s when features.friends is false", async () => {
    const routes = new Map();
    const app = {
      get: (p, h) => routes.set(`GET ${p}`, h),
      post: (p, h) => routes.set(`POST ${p}`, h),
      patch: (p, h) => routes.set(`PATCH ${p}`, h),
    };
    friendsApiRoute(app, {}, db, { friends: false }, {});
    const res = makeRes();
    await routes.get("GET /api/friends/list")({ query: { uuid: "uuid-actor" } }, res);
    expect(res.statusCode).toBe(404);
  });
});
