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

vi.mock("../../controllers/userController.js", () => ({
  getProfilePicture: vi.fn().mockResolvedValue("https://example.com/avatar.png"),
}));
vi.mock("../../lib/discord/resolveDiscordMember.mjs", () => ({
  resolveDiscordUserId: vi.fn(),
}));
vi.mock("node-fetch", () => ({ default: vi.fn() }));
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
import fetch from "node-fetch";
const { ProfileCommand } = await import("../../commands/profile.mjs");

function buildInteraction({ username = null, discordUser = null, discordTag = null } = {}) {
  return {
    options: {
      getString: (key) => key === "username" ? username : key === "discord_tag" ? discordTag : null,
      getUser: (key) => key === "discord_user" ? discordUser : null,
    },
    user: { id: "caller-123" },
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

const successfulProfile = {
  success: true,
  data: {
    profileData: {
      username: "TestPlayer",
      discordId: null,
      joined: "2022-01-01T00:00:00Z",
    },
    profileSession: { isOnline: false, lastOnlineDiff: null },
    profileStats: { totalLogins: 10, totalPlaytime: "5h" },
  },
};

describe("profile command", () => {
  let cmd;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.siteAddress = "http://localhost:3000";
    cmd = new ProfileCommand({ name: "profile" }, {});
  });

  it("replies with guidance when no arguments are given", async () => {
    const interaction = buildInteraction();
    await cmd.chatInputRun(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining("Please provide") })
    );
  });

  it("shows 'not linked' embed when Discord user lookup returns no profile", async () => {
    vi.mocked(resolveDiscordUserId).mockResolvedValue("discord-id-999");
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ success: false }) });

    const interaction = buildInteraction({ discordUser: { id: "discord-id-999" } });
    await cmd.chatInputRun(interaction);

    expect(interaction.reply).toHaveBeenCalledOnce();
    const embed = interaction.reply.mock.calls[0][0].embeds?.[0];
    expect(embed._desc).toContain("not linked");
  });

  it("shows generic error when username lookup returns no profile", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ success: false }) });

    const interaction = buildInteraction({ username: "NonExistentPlayer" });
    await cmd.chatInputRun(interaction);

    const embed = interaction.reply.mock.calls[0][0].embeds?.[0];
    expect(embed._desc).not.toContain("not linked");
    expect(embed._desc).toContain("does not exist");
  });

  it("shows 'unable to resolve' when Discord ID cannot be resolved", async () => {
    vi.mocked(resolveDiscordUserId).mockResolvedValue(null);
    const interaction = buildInteraction({ discordUser: { id: "bad-id" } });
    await cmd.chatInputRun(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining("Unable to resolve") })
    );
  });

  it("shows 'Failed to reach API' on fetch network error", async () => {
    vi.mocked(resolveDiscordUserId).mockResolvedValue("discord-id-1");
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const interaction = buildInteraction({ discordUser: { id: "discord-id-1" } });
    await cmd.chatInputRun(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining("Failed to reach") })
    );
  });

  it("shows 'Failed to reach API' on non-OK HTTP response", async () => {
    vi.mocked(resolveDiscordUserId).mockResolvedValue("discord-id-2");
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 });

    const interaction = buildInteraction({ discordUser: { id: "discord-id-2" } });
    await cmd.chatInputRun(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining("Failed to reach") })
    );
  });

  it("renders profile embed on successful username lookup", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => successfulProfile })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) }); // badges

    const interaction = buildInteraction({ username: "TestPlayer" });
    await cmd.chatInputRun(interaction);

    expect(interaction.reply).toHaveBeenCalledOnce();
    const callArg = interaction.reply.mock.calls[0][0];
    expect(callArg.embeds).toBeDefined();
    expect(callArg.embeds.length).toBeGreaterThan(0);
  });
});
