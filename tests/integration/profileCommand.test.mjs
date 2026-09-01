import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @sapphire/framework so Command is a plain base class
vi.mock("@sapphire/framework", () => ({
  Command: class {
    constructor(context, options) {
      this.context = context;
      this.options = options;
    }
  },
  RegisterBehavior: { BulkOverwrite: 1 },
}));

// The command looks profiles up in-process via userController / profileService /
// badgeController (no HTTP self-call), so those are the collaborators to stub.
const byUsername = vi.fn();
const byDiscordId = vi.fn();
vi.mock("../../controllers/userController.js", () => ({
  UserGetter: class {
    byUsername = byUsername;
    byDiscordId = byDiscordId;
  },
  getProfilePicture: vi.fn().mockResolvedValue("https://example.com/avatar.png"),
  getUserStats: vi.fn().mockResolvedValue({ totalLogins: 10, totalPlaytime: "5h" }),
  getUserLastSession: vi.fn().mockResolvedValue({ isOnline: false, lastOnlineDiff: null }),
}));
vi.mock("../../services/profileService.js", () => ({
  getUserRanks: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../controllers/badgeController.js", () => ({
  getBadgesForUser: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../lib/discord/resolveDiscordMember.mjs", () => ({
  resolveDiscordUserId: vi.fn(),
}));
vi.mock("discord.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    SapphireClient: class { constructor() {} },
    EmbedBuilder: class {
      setTitle(t) { this._title = t; return this; }
      setDescription(d) { this._desc = d; return this; }
      setColor() { return this; }
      setThumbnail() { return this; }
      addFields() { return this; }
      setTimestamp() { return this; }
      setFooter() { return this; }
    },
    Colors: { Red: 0xff0000, Blurple: 0x5865f2 },
  };
});

import { resolveDiscordUserId } from "../../lib/discord/resolveDiscordMember.mjs";
const { ProfileCommand } = await import("../../commands/profile.mjs");

function buildInteraction({ username = null, discordUser = null, discordTag = null } = {}) {
  return {
    options: {
      getString: (key) => (key === "username" ? username : key === "discord_tag" ? discordTag : null),
      getUser: (key) => (key === "discord_user" ? discordUser : null),
    },
    user: { id: "caller-123" },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  };
}

describe("profile command", () => {
  let cmd;

  beforeEach(() => {
    vi.clearAllMocks();
    cmd = new ProfileCommand({ name: "profile" }, {});
  });

  it("replies with guidance when no arguments are given (before deferring)", async () => {
    const interaction = buildInteraction();
    await cmd.chatInputRun(interaction);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining("Please provide") })
    );
  });

  it("defers, then shows 'not linked' embed when a Discord lookup finds no account", async () => {
    vi.mocked(resolveDiscordUserId).mockResolvedValue("discord-id-999");
    byDiscordId.mockResolvedValue(null);

    const interaction = buildInteraction({ discordUser: { id: "discord-id-999" } });
    await cmd.chatInputRun(interaction);

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    const embed = interaction.editReply.mock.calls.at(-1)[0].embeds?.[0];
    expect(embed._desc).toContain("not linked to a website account");
  });

  it("shows the generic 'does not exist' embed when a username lookup finds no account", async () => {
    byUsername.mockResolvedValue(null);

    const interaction = buildInteraction({ username: "NonExistentPlayer" });
    await cmd.chatInputRun(interaction);

    const embed = interaction.editReply.mock.calls.at(-1)[0].embeds?.[0];
    expect(embed._desc).not.toContain("not linked");
    expect(embed._desc).toContain("does not exist");
  });

  it("editReplies 'Unable to resolve' when the Discord info can't be resolved to an account", async () => {
    vi.mocked(resolveDiscordUserId).mockResolvedValue(null);
    const interaction = buildInteraction({ discordUser: { id: "bad-id" } });
    await cmd.chatInputRun(interaction);

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Unable to resolve") })
    );
  });

  it("editReplies a failure notice when the profile lookup throws", async () => {
    vi.mocked(resolveDiscordUserId).mockResolvedValue("discord-id-1");
    byDiscordId.mockRejectedValue(new Error("DB down"));

    const interaction = buildInteraction({ discordUser: { id: "discord-id-1" } });
    await cmd.chatInputRun(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Failed to look up the profile") })
    );
  });

  it("renders the profile embed on a successful username lookup", async () => {
    byUsername.mockResolvedValue({
      username: "TestPlayer",
      userId: 42,
      discordId: null,
      joined: "2022-01-01T00:00:00Z",
    });

    const interaction = buildInteraction({ username: "TestPlayer" });
    await cmd.chatInputRun(interaction);

    expect(interaction.editReply).toHaveBeenCalledOnce();
    const callArg = interaction.editReply.mock.calls[0][0];
    expect(callArg.embeds).toBeDefined();
    expect(callArg.embeds.length).toBeGreaterThan(0);
  });
});
