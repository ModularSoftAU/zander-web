import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleNameHistoryLookup } from "../../commands/namehistory.mjs";

function fakeInteraction({ username, channelId = "chan-1", userId = "user-1", isAdmin = false } = {}) {
  const replies = [];
  return {
    options: { getString: () => username },
    channelId,
    user: { id: userId },
    deferReply: vi.fn().mockResolvedValue(),
    editReply: vi.fn(async (payload) => {
      replies.push(payload);
      return payload;
    }),
    memberPermissions: { has: () => isAdmin },
    _replies: replies,
  };
}

describe("handleNameHistoryLookup", () => {
  it("rejects an invalid username without calling the lookup service", async () => {
    const lookupService = { lookupNameHistory: vi.fn() };
    const cooldownTracker = { isOnCooldown: () => false, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "bad name!" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(lookupService.lookupNameHistory).not.toHaveBeenCalled();
    expect(interaction._replies[0].content).toMatch(/valid Minecraft username/i);
  });

  it("returns the not-found message for a missing profile", async () => {
    const lookupService = { lookupNameHistory: vi.fn().mockResolvedValue({ status: "not_found" }) };
    const cooldownTracker = { isOnCooldown: () => false, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "MissingPlayer" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(interaction._replies[0].content).toBe('No NameMC profile could be found for "MissingPlayer".');
  });

  it("returns the unavailable message on unavailable status", async () => {
    const lookupService = { lookupNameHistory: vi.fn().mockResolvedValue({ status: "unavailable" }) };
    const cooldownTracker = { isOnCooldown: () => false, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "ErrorPlayer" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(interaction._replies[0].content).toMatch(/currently unavailable/i);
  });

  it("returns an embed for a found profile and records cooldown use", async () => {
    const lookupService = {
      lookupNameHistory: vi.fn().mockResolvedValue({
        status: "found",
        currentName: "CurrentPlayer",
        uuid: "00000000-0000-0000-0000-000000000000",
        previousNames: [],
        profileUrl: "https://namemc.com/profile/CurrentPlayer",
        avatarUrl: null,
      }),
    };
    const cooldownTracker = { isOnCooldown: () => false, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "CurrentPlayer" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(interaction._replies[0].embeds).toHaveLength(1);
    expect(cooldownTracker.recordUse).toHaveBeenCalledWith("user-1");
  });

  it("blocks a non-admin on cooldown with an ephemeral message and does not call the lookup service", async () => {
    const lookupService = { lookupNameHistory: vi.fn() };
    const cooldownTracker = { isOnCooldown: () => true, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "CurrentPlayer" });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: false });

    expect(lookupService.lookupNameHistory).not.toHaveBeenCalled();
    expect(interaction._replies[0].content).toMatch(/cooldown/i);
  });

  it("does not apply the per-user cooldown check for an admin", async () => {
    const lookupService = { lookupNameHistory: vi.fn().mockResolvedValue({ status: "not_found" }) };
    const cooldownTracker = { isOnCooldown: (id, isAdmin) => !isAdmin, recordUse: vi.fn() };
    const interaction = fakeInteraction({ username: "CurrentPlayer", isAdmin: true });

    await handleNameHistoryLookup(interaction, { lookupService, cooldownTracker, isAdmin: true });

    expect(lookupService.lookupNameHistory).toHaveBeenCalled();
  });
});
