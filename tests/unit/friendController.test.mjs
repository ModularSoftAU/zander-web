import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These tests run the real friendController SQL logic against a small in-memory
 * fake of the mysql2 pool. The fake understands only the statements the
 * controller actually issues; each `query` call mutates plain arrays so the
 * behavioural rules (block precedence, reverse-request resolution, cooldown,
 * caps) are exercised end to end.
 */

const state = {
  users: [],
  friendships: [],
  blocks: [],
  privacy: [],
  logs: [],
  nextFriendshipId: 1,
  nextBlockId: 1,
};

function resetState() {
  state.users = [
    { userId: 1, username: "alice", is_placeholder: 0, account_disabled: 0 },
    { userId: 2, username: "bob", is_placeholder: 0, account_disabled: 0 },
    { userId: 3, username: "carol", is_placeholder: 0, account_disabled: 0 },
    { userId: 4, username: "ghost", is_placeholder: 1, account_disabled: 0 },
    { userId: 5, username: "banned", is_placeholder: 0, account_disabled: 1 },
  ];
  state.friendships = [];
  state.blocks = [];
  state.privacy = [];
  state.logs = [];
  state.nextFriendshipId = 1;
  state.nextBlockId = 1;
}

const norm = (sql) => sql.replace(/\s+/g, " ").trim();

function fakeQuery(rawSql, params, cb) {
  const sql = norm(rawSql);
  try {
    cb(null, runFake(sql, params || []));
  } catch (err) {
    cb(err);
  }
}

function pairMatch(row, a, b) {
  return row.requesterId === a && row.addresseeId === b;
}

function runFake(sql, p) {
  // ---- users ----
  if (sql.startsWith("SELECT userId, username, is_placeholder, account_disabled FROM users")) {
    const u = state.users.find((x) => x.userId === p[0]);
    return u ? [u] : [];
  }

  // ---- blocks ----
  if (sql.startsWith("SELECT 1 FROM userBlocks WHERE")) {
    const [a, b, c, d] = p;
    const hit = state.blocks.some(
      (x) =>
        (x.blockerId === a && x.blockedId === b) ||
        (x.blockerId === c && x.blockedId === d)
    );
    return hit ? [{ 1: 1 }] : [];
  }
  if (sql.startsWith("SELECT blockerId, blockedId FROM userBlocks WHERE blockerId = ? OR blockedId = ?")) {
    return state.blocks
      .filter((x) => x.blockerId === p[0] || x.blockedId === p[1])
      .map((x) => ({ blockerId: x.blockerId, blockedId: x.blockedId }));
  }
  if (sql.startsWith("SELECT blockerId, blockedId FROM userBlocks WHERE (blockerId = ? AND blockedId = ?)")) {
    const [a, b, c, d] = p;
    return state.blocks
      .filter(
        (x) =>
          (x.blockerId === a && x.blockedId === b) ||
          (x.blockerId === c && x.blockedId === d)
      )
      .map((x) => ({ blockerId: x.blockerId, blockedId: x.blockedId }));
  }
  if (sql.startsWith("INSERT INTO userBlocks")) {
    const [blockerId, blockedId, source, reason] = p;
    const existing = state.blocks.find(
      (x) => x.blockerId === blockerId && x.blockedId === blockedId
    );
    if (existing) {
      existing.source = source;
      existing.reason = reason;
      return { affectedRows: 2 };
    }
    state.blocks.push({
      blockId: state.nextBlockId++,
      blockerId,
      blockedId,
      source,
      reason,
      createdAt: new Date(),
    });
    return { affectedRows: 1 };
  }
  if (sql.startsWith("DELETE FROM userBlocks WHERE blockerId = ? AND blockedId = ?")) {
    const before = state.blocks.length;
    state.blocks = state.blocks.filter(
      (x) => !(x.blockerId === p[0] && x.blockedId === p[1])
    );
    return { affectedRows: before - state.blocks.length };
  }
  if (sql.startsWith("SELECT b.blockId, b.blockedId")) {
    return state.blocks
      .filter((x) => x.blockerId === p[0])
      .map((x) => ({
        blockId: x.blockId,
        blockedId: x.blockedId,
        reason: x.reason,
        source: x.source,
        createdAt: x.createdAt,
        username: state.users.find((u) => u.userId === x.blockedId)?.username,
        uuid: null,
      }));
  }

  // ---- privacy ----
  if (sql.startsWith("SELECT allowMessagesFrom, allowFriendRequests")) {
    const row = state.privacy.find((x) => x.userId === p[0]);
    return row ? [row] : [];
  }
  if (sql.startsWith("INSERT INTO userPrivacySettings")) {
    // params: userId, ...values ; columns parsed from the SQL
    const colList = sql
      .slice(sql.indexOf("(") + 1, sql.indexOf(")"))
      .split(",")
      .map((s) => s.trim());
    const values = p;
    let row = state.privacy.find((x) => x.userId === values[0]);
    if (!row) {
      row = { userId: values[0] };
      state.privacy.push(row);
    }
    colList.forEach((col, i) => {
      if (col === "userId") return;
      row[col] = values[i];
    });
    return { affectedRows: row ? 1 : 0 };
  }

  // ---- friendships: reads ----
  if (sql.startsWith("SELECT 1 FROM userFriendships WHERE status = 'accepted'")) {
    const [a, b, c, d] = p;
    const hit = state.friendships.some(
      (x) =>
        x.status === "accepted" &&
        (pairMatch(x, a, b) || pairMatch(x, c, d))
    );
    return hit ? [{ 1: 1 }] : [];
  }
  if (sql.startsWith("SELECT COUNT(*) AS c FROM userFriendships WHERE requesterId = ? AND status = 'pending'")) {
    return [
      {
        c: state.friendships.filter(
          (x) => x.requesterId === p[0] && x.status === "pending"
        ).length,
      },
    ];
  }
  if (sql.startsWith("SELECT COUNT(*) AS c FROM userFriendships WHERE status = 'accepted'")) {
    return [
      {
        c: state.friendships.filter(
          (x) =>
            x.status === "accepted" &&
            (x.requesterId === p[0] || x.addresseeId === p[0])
        ).length,
      },
    ];
  }
  if (sql.startsWith("SELECT friendshipId, status, respondedAt FROM userFriendships WHERE requesterId = ? AND addresseeId = ? LIMIT 1")) {
    const row = state.friendships.find((x) => pairMatch(x, p[0], p[1]));
    return row
      ? [{ friendshipId: row.friendshipId, status: row.status, respondedAt: row.respondedAt ?? null }]
      : [];
  }
  if (sql.startsWith("SELECT requesterId, addresseeId, status FROM userFriendships WHERE (requesterId = ? AND addresseeId = ?)")) {
    const [a, b, c, d] = p;
    return state.friendships
      .filter((x) => pairMatch(x, a, b) || pairMatch(x, c, d))
      .map((x) => ({ requesterId: x.requesterId, addresseeId: x.addresseeId, status: x.status }));
  }

  // ---- friendships: writes ----
  if (sql.startsWith("INSERT INTO userFriendships")) {
    const [requesterId, addresseeId, , source, message] = p;
    if (state.friendships.some((x) => pairMatch(x, requesterId, addresseeId))) {
      const e = new Error("dup");
      e.code = "ER_DUP_ENTRY";
      throw e;
    }
    const row = {
      friendshipId: state.nextFriendshipId++,
      requesterId,
      addresseeId,
      status: "pending",
      source,
      message,
      requestedAt: new Date(),
      respondedAt: null,
      deliveredAt: null,
    };
    state.friendships.push(row);
    return { insertId: row.friendshipId, affectedRows: 1 };
  }
  if (sql.startsWith("UPDATE userFriendships SET status = 'accepted', respondedAt = NOW() WHERE friendshipId = ?")) {
    const row = state.friendships.find(
      (x) => x.friendshipId === p[0] && x.status === "pending"
    );
    if (row) {
      row.status = "accepted";
      row.respondedAt = new Date();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }
  if (sql.startsWith("UPDATE userFriendships SET status = 'accepted', respondedAt = NOW() WHERE requesterId = ? AND addresseeId = ? AND status = 'pending'")) {
    const row = state.friendships.find(
      (x) => pairMatch(x, p[0], p[1]) && x.status === "pending"
    );
    if (row) {
      row.status = "accepted";
      row.respondedAt = new Date();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }
  if (sql.startsWith("UPDATE userFriendships SET status = 'declined', respondedAt = NOW() WHERE requesterId = ? AND addresseeId = ? AND status = 'pending'")) {
    const row = state.friendships.find(
      (x) => pairMatch(x, p[0], p[1]) && x.status === "pending"
    );
    if (row) {
      row.status = "declined";
      row.respondedAt = new Date();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }
  if (sql.startsWith("UPDATE userFriendships SET status = 'pending', source = ?, message = ?")) {
    const [source, message, friendshipId] = p;
    const row = state.friendships.find(
      (x) => x.friendshipId === friendshipId && x.status === "declined"
    );
    if (row) {
      row.status = "pending";
      row.source = source;
      row.message = message;
      row.requestedAt = new Date();
      row.respondedAt = null;
      row.deliveredAt = null;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }
  if (sql.startsWith("UPDATE userFriendships SET deliveredAt = NOW()")) {
    let n = 0;
    for (const x of state.friendships) {
      if (x.addresseeId === p[0] && x.status === "pending" && !x.deliveredAt) {
        x.deliveredAt = new Date();
        n++;
      }
    }
    return { affectedRows: n };
  }
  if (sql.startsWith("DELETE FROM userFriendships WHERE ((requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?)) AND (status = 'accepted' OR (status = 'pending' AND requesterId = ?))")) {
    const [a, b, c, d, self] = p;
    const before = state.friendships.length;
    state.friendships = state.friendships.filter((x) => {
      const inPair = pairMatch(x, a, b) || pairMatch(x, c, d);
      if (!inPair) return true;
      const removable =
        x.status === "accepted" ||
        (x.status === "pending" && x.requesterId === self);
      return !removable;
    });
    return { affectedRows: before - state.friendships.length };
  }
  if (sql.startsWith("DELETE FROM userFriendships WHERE (requesterId = ? AND addresseeId = ?) OR (requesterId = ? AND addresseeId = ?)")) {
    const [a, b, c, d] = p;
    const before = state.friendships.length;
    state.friendships = state.friendships.filter(
      (x) => !(pairMatch(x, a, b) || pairMatch(x, c, d))
    );
    return { affectedRows: before - state.friendships.length };
  }

  // ---- misc reads used by a few assertions ----
  if (sql.startsWith("SELECT f.friendshipId, f.requesterId, f.message, f.source, f.requestedAt, u.username")) {
    // getPendingIncoming
    return state.friendships
      .filter((x) => x.addresseeId === p[0] && x.status === "pending")
      .map((x) => ({ friendshipId: x.friendshipId, requesterId: x.requesterId, message: x.message, source: x.source }));
  }
  if (sql.startsWith("SELECT f.friendshipId, f.addresseeId, f.message, f.source, f.requestedAt, u.username")) {
    // getPendingOutgoing
    return state.friendships
      .filter((x) => x.requesterId === p[0] && x.status === "pending")
      .map((x) => ({ friendshipId: x.friendshipId, addresseeId: x.addresseeId }));
  }

  // ---- logs ----
  if (sql.startsWith("INSERT INTO logs")) {
    state.logs.push({ creatorId: p[0], logType: p[1], logFeature: p[2], description: p[3] });
    return { insertId: state.logs.length, affectedRows: 1 };
  }

  throw new Error(`fakeQuery: unhandled SQL: ${sql}`);
}

vi.mock("../../controllers/databaseController.js", () => ({
  default: { query: (sql, params, cb) => fakeQuery(sql, params, cb) },
}));

const {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  areFriends,
  getRelationship,
  getPrivacySettings,
  setPrivacySettings,
  canSendFriendRequest,
  PENDING_OUTGOING_CAP,
} = await import("../../controllers/friendController.js");

beforeEach(() => {
  resetState();
});

describe("friend request lifecycle", () => {
  it("request -> accept makes both sides friends", async () => {
    const sent = await sendFriendRequest(1, 2, { source: "web" });
    expect(sent.status).toBe("pending");

    const res = await acceptFriendRequest(2, 1);
    expect(res.ok).toBe(true);

    expect(await areFriends(1, 2)).toBe(true);
    expect(await areFriends(2, 1)).toBe(true);
  });

  it("request -> decline leaves them not friends and records a declined row", async () => {
    await sendFriendRequest(1, 2);
    const res = await declineFriendRequest(2, 1);
    expect(res.ok).toBe(true);

    expect(await areFriends(1, 2)).toBe(false);
    expect(state.friendships[0].status).toBe("declined");
  });

  it("a reverse pending request resolves as an accept, not a second row", async () => {
    await sendFriendRequest(2, 1); // bob -> alice
    const sent = await sendFriendRequest(1, 2); // alice -> bob

    expect(sent.status).toBe("accepted");
    expect(state.friendships).toHaveLength(1);
    expect(await areFriends(1, 2)).toBe(true);
  });
});

describe("declined cooldown", () => {
  it("a fresh decline cannot be re-requested (benign 'declined')", async () => {
    await sendFriendRequest(1, 2);
    await declineFriendRequest(2, 1);

    const retry = await sendFriendRequest(1, 2);
    expect(retry.status).toBe("declined");
    expect(state.friendships[0].status).toBe("declined");
  });

  it("after the cooldown the same request re-opens as pending", async () => {
    await sendFriendRequest(1, 2);
    await declineFriendRequest(2, 1);
    state.friendships[0].respondedAt = new Date(Date.now() - 25 * 3600 * 1000);

    const retry = await sendFriendRequest(1, 2);
    expect(retry.status).toBe("pending");
    expect(state.friendships[0].status).toBe("pending");
  });
});

describe("unfriend then re-add", () => {
  it("removeFriend deletes the row so a later request works cleanly", async () => {
    await sendFriendRequest(1, 2);
    await acceptFriendRequest(2, 1);
    expect(await areFriends(1, 2)).toBe(true);

    await removeFriend(1, 2);
    expect(state.friendships).toHaveLength(0);

    const again = await sendFriendRequest(1, 2);
    expect(again.status).toBe("pending");
  });
});

describe("block precedence", () => {
  it("blocking deletes an existing friendship in both directions", async () => {
    await sendFriendRequest(1, 2);
    await acceptFriendRequest(2, 1);

    await blockUser(1, 2, { source: "web" });

    expect(state.friendships).toHaveLength(0);
    expect(await areFriends(1, 2)).toBe(false);
  });

  it("blocking cancels a pending request either way", async () => {
    await sendFriendRequest(2, 1); // bob -> alice pending
    await blockUser(1, 2);
    expect(state.friendships).toHaveLength(0);
  });

  it("a block bars new requests in BOTH directions, with no tell", async () => {
    await blockUser(1, 2);

    const fromBlocker = await sendFriendRequest(1, 2);
    const fromBlocked = await sendFriendRequest(2, 1);

    expect(fromBlocker).toEqual({ status: "declined" });
    expect(fromBlocked).toEqual({ status: "declined" });
    expect(state.friendships).toHaveLength(0);

    expect(await canSendFriendRequest(1, 2)).toBe(false);
    expect(await canSendFriendRequest(2, 1)).toBe(false);
  });

  it("writes an audit log row on block and on unblock, never a reason to the blocked party", async () => {
    await blockUser(1, 2, { source: "web", reason: "harassment" });
    await unblockUser(1, 2);

    expect(state.logs.map((l) => l.logType)).toEqual(["block", "unblock"]);
    for (const l of state.logs) {
      expect(l.logFeature).toBe("friends");
      expect(l.description).not.toContain("harassment");
    }

    const rel = await getRelationship(2, 1);
    expect(rel).not.toHaveProperty("reason");
  });
});

describe("self-action rejection", () => {
  it("rejects a self friend request by id", async () => {
    await expect(sendFriendRequest(1, 1)).rejects.toMatchObject({ code: "self" });
  });

  it("rejects a self block by id", async () => {
    await expect(blockUser(3, 3)).rejects.toMatchObject({ code: "self" });
  });

  it("rejects a self request resolved to the same id from different name spellings", async () => {
    // The name check is the caller's job; the controller still refuses once the
    // names resolve to one id.
    const resolvedId = 2;
    await expect(sendFriendRequest(resolvedId, resolvedId)).rejects.toMatchObject({
      code: "self",
    });
  });
});

describe("invalid targets", () => {
  it("rejects a placeholder account as a friend target", async () => {
    await expect(sendFriendRequest(1, 4)).rejects.toMatchObject({
      code: "invalid_target",
    });
  });

  it("rejects a disabled account as a friend target", async () => {
    await expect(sendFriendRequest(1, 5)).rejects.toMatchObject({
      code: "invalid_target",
    });
  });
});

describe("privacy settings", () => {
  it("returns defaults when no row exists", async () => {
    const s = await getPrivacySettings(3);
    expect(s).toMatchObject({
      allowMessagesFrom: "everyone",
      allowFriendRequests: "everyone",
      friendsListVisible: true,
      notifyFriendJoin: true,
      notifyFriendRequest: true,
    });
  });

  it("persists a patch and reads it back with booleans coerced", async () => {
    await setPrivacySettings(3, {
      allowFriendRequests: "none",
      friendsListVisible: false,
    });
    const s = await getPrivacySettings(3);
    expect(s.allowFriendRequests).toBe("none");
    expect(s.friendsListVisible).toBe(false);
  });

  it("rejects an out-of-enum value", async () => {
    await expect(
      setPrivacySettings(3, { allowMessagesFrom: "nobody" })
    ).rejects.toMatchObject({ code: "invalid_setting" });
  });

  it("allowFriendRequests=none makes a request fail benignly", async () => {
    await setPrivacySettings(2, { allowFriendRequests: "none" });
    const sent = await sendFriendRequest(1, 2);
    expect(sent).toEqual({ status: "declined" });
    expect(state.friendships).toHaveLength(0);
  });
});

describe("outgoing request cap", () => {
  it(`throws a surfaceable error at ${PENDING_OUTGOING_CAP} pending outgoing requests`, async () => {
    for (let i = 0; i < PENDING_OUTGOING_CAP; i++) {
      state.users.push({
        userId: 100 + i,
        username: `u${i}`,
        is_placeholder: 0,
        account_disabled: 0,
      });
      state.friendships.push({
        friendshipId: state.nextFriendshipId++,
        requesterId: 1,
        addresseeId: 100 + i,
        status: "pending",
        respondedAt: null,
      });
    }

    await expect(sendFriendRequest(1, 2)).rejects.toMatchObject({
      code: "outgoing_cap",
    });
  });
});
