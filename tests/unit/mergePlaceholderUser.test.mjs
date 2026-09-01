import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbQuery = vi.fn();

vi.mock("../../controllers/databaseController.js", () => ({
  default: { query: mockDbQuery },
  luckpermsDb: { query: vi.fn() },
}));

vi.mock("../../api/common.js", () => ({
  hashEmail: vi.fn(async (email) => `hash:${email}`),
}));

const { mergePlaceholderUser } = await import("../../controllers/userController.js");

function installUsers(rowsByUserId, extraSelects = {}) {
  mockDbQuery.mockImplementation((sql, params, cb) => {
    const flat = sql.replace(/\s+/g, " ").trim();
    if (/SELECT \* FROM users WHERE userId = \?/.test(sql)) {
      const row = rowsByUserId[params[0]];
      cb(null, row ? [row] : []);
      return;
    }
    if (/^SELECT friendshipId, requesterId, addresseeId FROM userFriendships/.test(flat)) {
      cb(null, extraSelects.friendships?.(params) ?? []);
      return;
    }
    if (/^SELECT requesterId, addresseeId FROM userFriendships/.test(flat)) {
      cb(null, extraSelects.survivorFriendships?.(params) ?? []);
      return;
    }
    if (/^SELECT blockId, blockerId, blockedId FROM userBlocks/.test(flat)) {
      cb(null, extraSelects.blocks?.(params) ?? []);
      return;
    }
    if (/^SELECT blockerId, blockedId FROM userBlocks/.test(flat)) {
      cb(null, extraSelects.survivorBlocks?.(params) ?? []);
      return;
    }
    if (/^SELECT/i.test(flat)) {
      cb(null, []);
      return;
    }
    // Every UPDATE / DELETE just succeeds.
    cb(null, { affectedRows: 1 });
  });
}

function sqlCalls() {
  return mockDbQuery.mock.calls.map(([sql, params]) => ({
    sql: sql.replace(/\s+/g, " ").trim(),
    params,
  }));
}

describe("mergePlaceholderUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transfers the discordId, repoints ticket references, and deletes the placeholder", async () => {
    installUsers({
      10: { userId: 10, uuid: "ghost-uuid", discordId: "discord-123", is_placeholder: 1 },
      20: { userId: 20, uuid: "real-uuid", discordId: null, is_placeholder: 0 },
    });

    const summary = await mergePlaceholderUser(10, 20);

    expect(summary).toMatchObject({
      placeholderUserId: 10,
      survivingUserId: 20,
      discordIdTransferred: true,
    });

    const calls = sqlCalls();

    // discordId moved onto the surviving row
    expect(calls).toContainEqual({
      sql: "UPDATE users SET discordId = ? WHERE userId = ?",
      params: ["discord-123", 20],
    });
    // placeholder discordId cleared before deletion
    expect(calls).toContainEqual({
      sql: "UPDATE users SET discordId = NULL WHERE userId = ?",
      params: [10],
    });

    // foreign-key references repointed onto the surviving row
    for (const table of ["supportTickets", "supportTicketMessages", "userNotifications"]) {
      expect(calls).toContainEqual({
        sql: `UPDATE ${table} SET userId = ? WHERE userId = ?`,
        params: [20, 10],
      });
    }
    expect(calls).toContainEqual({
      sql: "UPDATE IGNORE supportTicketParticipants SET userId = ? WHERE userId = ?",
      params: [20, 10],
    });

    // pending verify-link rows for the ghost uuid removed
    expect(calls).toContainEqual({
      sql: "DELETE FROM userVerifyLink WHERE uuid = ?",
      params: ["ghost-uuid"],
    });

    // placeholder row deleted last
    expect(calls).toContainEqual({
      sql: "DELETE FROM users WHERE userId = ?",
      params: [10],
    });
  });

  it("does not overwrite an existing discordId on the surviving row", async () => {
    installUsers({
      10: { userId: 10, uuid: "ghost-uuid", discordId: "discord-ghost", is_placeholder: 1 },
      20: { userId: 20, uuid: "real-uuid", discordId: "discord-real", is_placeholder: 0 },
    });

    const summary = await mergePlaceholderUser(10, 20);

    expect(summary.discordIdTransferred).toBe(false);
    expect(sqlCalls()).not.toContainEqual({
      sql: "UPDATE users SET discordId = ? WHERE userId = ?",
      params: ["discord-ghost", 20],
    });
  });

  it("rejects when the two ids are the same", async () => {
    await expect(mergePlaceholderUser(5, 5)).rejects.toThrow(/distinct/);
  });

  it("rejects when the placeholder row is missing", async () => {
    installUsers({ 20: { userId: 20, uuid: "real-uuid", is_placeholder: 0 } });
    await expect(mergePlaceholderUser(10, 20)).rejects.toThrow(/Placeholder user 10 not found/);
  });

  describe("friend graph folding", () => {
    const users = {
      10: { userId: 10, uuid: "ghost-uuid", discordId: "d", is_placeholder: 1 },
      20: { userId: 20, uuid: "real-uuid", discordId: null, is_placeholder: 0 },
    };

    it("repoints a placeholder friendship onto the surviving account", async () => {
      installUsers(users, {
        // ghost (10) is friends with user 30
        friendships: () => [{ friendshipId: 1, requesterId: 10, addresseeId: 30 }],
      });

      await mergePlaceholderUser(10, 20);
      const calls = sqlCalls();

      expect(calls).toContainEqual({
        sql: "UPDATE userFriendships SET requesterId = ? WHERE friendshipId = ? AND requesterId = ?",
        params: [20, 1, 10],
      });
      expect(calls).toContainEqual({
        sql: "UPDATE userFriendships SET addresseeId = ? WHERE friendshipId = ? AND addresseeId = ?",
        params: [20, 1, 10],
      });
      expect(calls).not.toContainEqual(
        expect.objectContaining({ sql: "DELETE FROM userFriendships WHERE friendshipId = ?" })
      );
    });

    it("drops a placeholder friendship that would self-loop with the survivor", async () => {
      installUsers(users, {
        // ghost (10) and the surviving account (20) are already 'friends'
        friendships: () => [{ friendshipId: 7, requesterId: 20, addresseeId: 10 }],
      });

      await mergePlaceholderUser(10, 20);

      expect(sqlCalls()).toContainEqual({
        sql: "DELETE FROM userFriendships WHERE friendshipId = ?",
        params: [7],
      });
    });

    it("de-dupes a friendship the survivor already holds with the same person", async () => {
      installUsers(users, {
        friendships: () => [{ friendshipId: 3, requesterId: 30, addresseeId: 10 }],
        survivorFriendships: () => [{ requesterId: 20, addresseeId: 30 }],
      });

      await mergePlaceholderUser(10, 20);
      const calls = sqlCalls();

      expect(calls).toContainEqual({
        sql: "DELETE FROM userFriendships WHERE friendshipId = ?",
        params: [3],
      });
      expect(calls).not.toContainEqual(
        expect.objectContaining({
          sql: "UPDATE userFriendships SET requesterId = ? WHERE friendshipId = ? AND requesterId = ?",
        })
      );
    });

    it("repoints a block and de-dupes one the survivor already has", async () => {
      installUsers(users, {
        blocks: () => [
          { blockId: 1, blockerId: 10, blockedId: 40 }, // new -> repoint
          { blockId: 2, blockerId: 10, blockedId: 50 }, // dup -> delete
        ],
        survivorBlocks: () => [{ blockerId: 20, blockedId: 50 }],
      });

      await mergePlaceholderUser(10, 20);
      const calls = sqlCalls();

      expect(calls).toContainEqual({
        sql: "UPDATE userBlocks SET blockerId = ?, blockedId = ? WHERE blockId = ?",
        params: [20, 40, 1],
      });
      expect(calls).toContainEqual({
        sql: "DELETE FROM userBlocks WHERE blockId = ?",
        params: [2],
      });
    });

    it("always drops the placeholder's privacy row", async () => {
      installUsers(users);
      await mergePlaceholderUser(10, 20);
      expect(sqlCalls()).toContainEqual({
        sql: "DELETE FROM userPrivacySettings WHERE userId = ?",
        params: [10],
      });
    });
  });
});
