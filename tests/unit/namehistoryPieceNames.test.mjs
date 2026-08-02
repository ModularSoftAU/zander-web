// tests/unit/namehistoryPieceNames.test.mjs
//
// Regression test for a Sapphire piece-loader collision: both
// NameHistoryCommand and NhCommand live in commands/namehistory.mjs.
// Sapphire's piece loader names every piece after the file basename by
// default ("namehistory" for both), so without an explicit `name` passed
// to `super(context, {...options, name: "..."})` in each constructor, the
// second piece loaded would silently evict the first from the CommandStore
// at boot — even though both slash commands get registered with Discord.
//
// This test constructs both classes directly (bypassing the full loader)
// with the minimal fake `context` Sapphire's `Piece` base constructor
// needs (`store`, `path`, `root` — see @sapphire/pieces' Piece constructor,
// which does `this.name = options.name ?? context.name`) and asserts the
// resolved `.name` differs between the two pieces and matches the
// slash-command names actually registered with Discord.
import { describe, it, expect, beforeAll } from "vitest";
import { container } from "@sapphire/framework";
import { NameHistoryCommand, NhCommand } from "../../commands/namehistory.mjs";

function fakeContext(basename) {
  return {
    store: { name: "commands" },
    path: `/fake/commands/${basename}.mjs`,
    root: "/fake",
    name: basename, // what the loader would derive from the file basename
  };
}

describe("namehistory.mjs piece names", () => {
  beforeAll(() => {
    // Command's base constructor reads container.client.options (for its
    // cooldown precondition resolution) — stub the minimal shape needed so
    // the real Sapphire Command constructor runs without a full client.
    container.client = { options: {} };
  });

  it("gives NameHistoryCommand and NhCommand distinct Sapphire piece names", () => {
    // Both pieces are loaded from the same file, so the loader-derived
    // context.name is identical for both — this is exactly the collision
    // scenario that happens at boot.
    const nameHistory = new NameHistoryCommand(fakeContext("namehistory"), {});
    const nh = new NhCommand(fakeContext("namehistory"), {});

    expect(nameHistory.name).toBe("namehistory");
    expect(nh.name).toBe("nh");
    expect(nameHistory.name).not.toBe(nh.name);
  });
});
