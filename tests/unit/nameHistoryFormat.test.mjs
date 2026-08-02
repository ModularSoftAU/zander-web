// tests/unit/nameHistoryFormat.test.mjs
import { describe, it, expect, vi } from "vitest";
import {
  buildNameHistoryEmbedData,
  NOT_FOUND_MESSAGE,
  UNAVAILABLE_MESSAGE,
  createCooldownTracker,
} from "../../lib/discord/nameHistoryFormat.mjs";

describe("buildNameHistoryEmbedData", () => {
  it("lists previous names with change dates", () => {
    const data = buildNameHistoryEmbedData({
      status: "found",
      currentName: "CurrentPlayer",
      uuid: "00000000-0000-0000-0000-000000000000",
      previousNames: [
        { name: "OriginalPlayer", changedAt: new Date("2025-01-04T00:00:00Z") },
        { name: "SecondPlayer", changedAt: new Date("2026-03-18T00:00:00Z") },
      ],
      profileUrl: "https://namemc.com/profile/CurrentPlayer",
      avatarUrl: "https://namemc.com/avatar/CurrentPlayer.png",
    });
    expect(data.title).toContain("CurrentPlayer");
    const previousField = data.fields.find((f) => f.name === "Previous names");
    expect(previousField.value).toContain("OriginalPlayer");
    expect(previousField.value).toContain("SecondPlayer");
    expect(data.footer).toContain("Mojang");
    expect(data.footer).toContain("NameMC");
    expect(data.thumbnailUrl).toBe("https://namemc.com/avatar/CurrentPlayer.png");
  });

  it("shows the no-history message when previousNames is empty", () => {
    const data = buildNameHistoryEmbedData({
      status: "found",
      currentName: "SoloPlayer",
      uuid: "1",
      previousNames: [],
      profileUrl: "https://namemc.com/profile/SoloPlayer",
      avatarUrl: null,
    });
    const previousField = data.fields.find((f) => f.name === "Previous names");
    expect(previousField.value).toBe("No previous usernames were found on NameMC for this profile.");
  });

  it("sanitizes mention-like content in names", () => {
    const data = buildNameHistoryEmbedData({
      status: "found",
      currentName: "@everyone",
      uuid: "1",
      previousNames: [],
      profileUrl: "https://namemc.com/profile/x",
      avatarUrl: null,
    });
    expect(data.title).not.toContain("@everyone");
  });
});

describe("NOT_FOUND_MESSAGE / UNAVAILABLE_MESSAGE", () => {
  it("formats the not-found message with the username", () => {
    expect(NOT_FOUND_MESSAGE("ExamplePlayer")).toBe(
      'No Minecraft account named "ExamplePlayer" could be found.'
    );
  });

  it("has a fixed unavailable message", () => {
    expect(UNAVAILABLE_MESSAGE).toBe(
      "The Minecraft account lookup service is currently unavailable, so this username could not be checked. Please try again later."
    );
  });
});

describe("createCooldownTracker", () => {
  it("is not on cooldown before first use", () => {
    const tracker = createCooldownTracker(10);
    expect(tracker.isOnCooldown("user-1", false)).toBe(false);
  });

  it("is on cooldown immediately after use for a non-admin", () => {
    const tracker = createCooldownTracker(10);
    tracker.recordUse("user-1");
    expect(tracker.isOnCooldown("user-1", false)).toBe(true);
  });

  it("admins bypass the per-user cooldown", () => {
    const tracker = createCooldownTracker(10);
    tracker.recordUse("user-1");
    expect(tracker.isOnCooldown("user-1", true)).toBe(false);
  });

  it("cooldown clears after the window passes", () => {
    vi.useFakeTimers();
    const tracker = createCooldownTracker(10);
    tracker.recordUse("user-1");
    vi.advanceTimersByTime(11_000);
    expect(tracker.isOnCooldown("user-1", false)).toBe(false);
    vi.useRealTimers();
  });
});
