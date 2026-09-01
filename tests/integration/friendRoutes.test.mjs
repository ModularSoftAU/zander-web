import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level tests for the session-authed friends endpoints in
 * routes/profileRoutes.js: the auth boundary and the viewer-aware visibility
 * matrix for the friends list. Collaborators are mocked; the handlers are driven
 * directly with fake req/res doubles.
 */

// --- friends system collaborators ---------------------------------------
const friendCtl = {
  FriendActionError: class FriendActionError extends Error {
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
  getRelationship: vi.fn().mockResolvedValue({
    isSelf: false,
    isFriend: false,
    pendingIncoming: false,
    pendingOutgoing: false,
    blockedByMe: false,
    blockedMe: false,
  }),
  getPendingIncoming: vi.fn().mockResolvedValue([]),
  getPendingOutgoing: vi.fn().mockResolvedValue([]),
  getPrivacySettings: vi.fn().mockResolvedValue({
    allowMessagesFrom: "everyone",
    allowFriendRequests: "everyone",
    friendsListVisible: true,
    notifyFriendJoin: true,
    notifyFriendRequest: true,
  }),
  setPrivacySettings: vi.fn().mockResolvedValue({}),
};
vi.mock("../../controllers/friendController.js", () => friendCtl);

const invalidateFriendCaches = vi.fn();
vi.mock("../../lib/friendsCache.mjs", () => ({
  getCachedFriendCount: vi.fn().mockResolvedValue(0),
  getCachedMutualFriends: vi.fn().mockResolvedValue({ total: 0, friends: [] }),
  invalidateFriendCaches,
}));

const createNotificationsForUsers = vi.fn().mockResolvedValue(1);
vi.mock("../../controllers/notificationController.js", () => ({
  createNotificationsForUsers,
}));

vi.mock("../../lib/rateLimiter.mjs", () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
}));

const getUserByUsername = vi.fn();
vi.mock("../../services/profileService.js", () => ({
  getUserByUsername,
  getUserRanks: vi.fn().mockResolvedValue([]),
  getReportsByReporterId: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getUserPunishments: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock("../../lib/avatarHelpers.js", () => ({
  resolveAvatarUrl: vi.fn().mockResolvedValue("https://example.test/a.png"),
}));

let loggedIn = true;
vi.mock("../../api/common.js", () => ({
  isLoggedIn: vi.fn(() => loggedIn),
  setBannerCookie: vi.fn(),
  getGlobalImage: vi.fn().mockResolvedValue("img/x.png"),
}));
vi.mock("../../controllers/announcementController.js", () => ({
  getWebAnnouncement: vi.fn().mockResolvedValue(null),
}));

// --- heavy leaf imports pulled in by other routes in the same file -----
vi.mock("../../controllers/userController.js", () => ({
  UserGetter: class {
    hasJoined = vi.fn().mockResolvedValue(true);
    byUsername = vi.fn().mockResolvedValue(null);
  },
  getProfilePicture: vi.fn(),
  getUserLastSession: vi.fn(),
  getUserPermissions: vi.fn(),
  getUserStats: vi.fn(),
  linkDiscordAccount: vi.fn(),
  unlinkDiscordAccount: vi.fn(),
}));
vi.mock("../../controllers/supportTicketController.js", () => ({
  getTicketsAccessibleByUser: vi.fn(),
  getOpenTicketsWithChannelForUser: vi.fn(),
}));
vi.mock("../../controllers/badgeController.js", () => ({ getBadgesForUser: vi.fn() }));
vi.mock("../../controllers/webstoreController.js", () => ({ retryDeferredDiscordRoles: vi.fn() }));
vi.mock("../../controllers/discordPunishmentController.js", () => ({
  getDiscordPunishmentsForProfile: vi.fn(),
  hasActiveWebBan: vi.fn().mockResolvedValue(false),
}));
vi.mock("../../controllers/watchController.js", () => ({
  getPlatformConnectionsByUserId: vi.fn(),
  upsertPlatformConnection: vi.fn(),
  deactivatePlatformConnection: vi.fn(),
}));
vi.mock("../../lib/discord/nicknameCheck.mjs", () => ({ checkAndReportNickname: vi.fn() }));
vi.mock("../../lib/discord/rankRoleSync.mjs", () => ({
  syncMemberRankRoles: vi.fn(),
  stripAllTrackedRankRoles: vi.fn(),
}));
vi.mock("../../controllers/mixedController.js", () => ({
  normaliseUuid: vi.fn((u) => u),
  getPlayer: vi.fn(),
}));

const profileSiteRoutes = (await import("../../routes/profileRoutes.js")).default;

// --- harness ----------------------------------------------------------
function buildRoutes(features = { friends: true }) {
  const routes = new Map();
  const app = {
    get: (path, handler) => routes.set(`GET ${path}`, handler),
    post: (path, handler) => routes.set(`POST ${path}`, handler),
    view: vi.fn().mockResolvedValue("<html></html>"),
  };
  profileSiteRoutes(app, {}, vi.fn(), {}, { siteConfiguration: {} }, {}, features, {});
  return { routes, app };
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    sent: null,
    redirectedTo: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    header(k, v) {
      this.headers[k] = v;
      return this;
    },
    send(p) {
      this.sent = p;
      return this;
    },
    redirect(url) {
      this.redirectedTo = url;
      return this;
    },
    view: vi.fn().mockResolvedValue("<html></html>"),
  };
  return res;
}

function makeReq(over = {}) {
  return {
    params: {},
    body: {},
    query: {},
    cookies: {},
    session: { user: { userId: 10, username: "viewer" } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loggedIn = true;
  getUserByUsername.mockResolvedValue({
    userId: 20,
    username: "target",
    uuid: "u-20",
    is_placeholder: 0,
    account_disabled: 0,
  });
});

describe("session-auth boundary", () => {
  it("rejects an unauthenticated friend request without calling the controller", async () => {
    loggedIn = false;
    const { routes } = buildRoutes();
    const res = makeRes();
    await routes.get("POST /profile/:username/friend/request")(
      makeReq({ params: { username: "target" }, session: {} }),
      res
    );

    expect(res.redirectedTo).toBe("/login");
    expect(friendCtl.sendFriendRequest).not.toHaveBeenCalled();
  });

  it("passes an authenticated request straight to sendFriendRequest with source 'web'", async () => {
    const { routes } = buildRoutes();
    const res = makeRes();
    await routes.get("POST /profile/:username/friend/request")(
      makeReq({ params: { username: "target" }, body: { message: "hi" } }),
      res
    );

    expect(friendCtl.sendFriendRequest).toHaveBeenCalledWith(10, 20, {
      source: "web",
      message: "hi",
    });
    expect(invalidateFriendCaches).toHaveBeenCalledWith(10, 20);
  });

  it("does not notify on decline", async () => {
    const { routes } = buildRoutes();
    await routes.get("POST /profile/:username/friend/decline")(
      makeReq({ params: { username: "target" } }),
      makeRes()
    );
    expect(friendCtl.declineFriendRequest).toHaveBeenCalledWith(10, 20);
    expect(createNotificationsForUsers).not.toHaveBeenCalled();
  });

  it("feature flag off short-circuits the route", async () => {
    const { routes } = buildRoutes({ friends: false });
    const res = makeRes();
    await routes.get("POST /profile/:username/friend/request")(
      makeReq({ params: { username: "target" } }),
      res
    );
    expect(friendCtl.sendFriendRequest).not.toHaveBeenCalled();
    expect(res.redirectedTo).toBe("/profile/target");
  });
});

describe("friends list visibility matrix", () => {
  async function renderList(reqOver) {
    const { routes, app } = buildRoutes();
    const res = makeRes();
    await routes.get("GET /profile/:username/friends")(makeReq(reqOver), res);
    const call = app.view.mock.calls.find((c) => c[0] === "modules/profile/friendsList");
    return call ? call[1] : null;
  }

  it("hides a private list from a non-owner viewer", async () => {
    friendCtl.getPrivacySettings.mockResolvedValue({
      allowMessagesFrom: "everyone",
      allowFriendRequests: "everyone",
      friendsListVisible: false,
      notifyFriendJoin: true,
      notifyFriendRequest: true,
    });
    const locals = await renderList({ params: { username: "target" } });
    expect(locals.hidden).toBe(true);
    expect(locals.friends).toEqual([]);
    expect(friendCtl.getFriends).not.toHaveBeenCalled();
  });

  it("shows a private list to the owner", async () => {
    friendCtl.getPrivacySettings.mockResolvedValue({
      allowMessagesFrom: "everyone",
      allowFriendRequests: "everyone",
      friendsListVisible: false,
      notifyFriendJoin: true,
      notifyFriendRequest: true,
    });
    const locals = await renderList({
      params: { username: "target" },
      session: { user: { userId: 20, username: "target" } },
    });
    expect(locals.hidden).toBe(false);
    expect(friendCtl.getFriends).toHaveBeenCalledWith(20, { viewerId: 20 });
  });

  it("hides the list when the owner has blocked the viewer", async () => {
    friendCtl.getRelationship.mockResolvedValue({
      isSelf: false,
      isFriend: false,
      pendingIncoming: false,
      pendingOutgoing: false,
      blockedByMe: false,
      blockedMe: true,
    });
    const locals = await renderList({ params: { username: "target" } });
    expect(locals.hidden).toBe(true);
    expect(friendCtl.getFriends).not.toHaveBeenCalled();
  });
});
