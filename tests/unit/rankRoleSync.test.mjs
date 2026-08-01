import { describe, it, expect } from "vitest";
import { diffTrackedRoles } from "../../lib/discord/rankRoleSync.mjs";

describe("diffTrackedRoles", () => {
  it("adds a role the member should have but doesn't", () => {
    const result = diffTrackedRoles([], ["role-a"], ["role-a", "role-b"]);
    expect(result).toEqual({ toAdd: ["role-a"], toRemove: [] });
  });

  it("removes a tracked role the member has but shouldn't", () => {
    const result = diffTrackedRoles(["role-a"], [], ["role-a", "role-b"]);
    expect(result).toEqual({ toAdd: [], toRemove: ["role-a"] });
  });

  it("never touches a role outside the tracked set, even if the member holds it", () => {
    const result = diffTrackedRoles(["untracked-role"], [], ["role-a"]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });

  it("never adds a role outside the tracked set", () => {
    const result = diffTrackedRoles([], ["untracked-role"], ["role-a"]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });

  it("is a no-op when current roles already match should-have roles", () => {
    const result = diffTrackedRoles(["role-a"], ["role-a"], ["role-a", "role-b"]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });

  it("handles multiple ranks worth of roles at once", () => {
    const result = diffTrackedRoles(
      ["role-a", "role-c"],
      ["role-a", "role-b"],
      ["role-a", "role-b", "role-c", "role-d"]
    );
    expect(result.toAdd).toEqual(["role-b"]);
    expect(result.toRemove).toEqual(["role-c"]);
  });

  it("deduplicates input arrays", () => {
    const result = diffTrackedRoles(["role-a", "role-a"], ["role-a"], ["role-a"]);
    expect(result).toEqual({ toAdd: [], toRemove: [] });
  });
});
