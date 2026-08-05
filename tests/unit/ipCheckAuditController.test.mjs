import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("../../controllers/databaseController.js", () => ({
  default: { query: queryMock },
}));

const { recordAuditLog, sendAuditEmbed } = await import(
  "../../controllers/ipCheckAuditController.js"
);

beforeEach(() => {
  queryMock.mockReset();
});

describe("recordAuditLog", () => {
  it("inserts an audit row with the full unmasked search target", async () => {
    queryMock.mockImplementation((sql, params, cb) => cb(null));
    await recordAuditLog({
      discordUserId: "123",
      discordTag: "staff#0001",
      permissionNode: "zander.discord.ipcheck",
      queryType: "IP",
      searchTarget: "203.0.113.15",
      resultCount: 2,
      success: true,
      guildId: "g1",
      channelId: "c1",
    });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO ip_check_audit_log/i);
    expect(params).toEqual([
      "123", "staff#0001", "zander.discord.ipcheck", "IP", "203.0.113.15", 2, true, "g1", "c1",
    ]);
  });
});

describe("sendAuditEmbed", () => {
  it("does nothing when no audit channel id is configured", async () => {
    const client = { channels: { fetch: vi.fn() } };
    await sendAuditEmbed(client, "", { discordUserId: "123", discordTag: "t", queryType: "IP", searchTarget: "203.0.113.15", resultCount: 1, success: true });
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });

  it("masks the IP in the posted embed", async () => {
    const send = vi.fn();
    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue({ isTextBased: () => true, send }),
      },
    };
    await sendAuditEmbed(client, "audit-channel", {
      discordUserId: "123",
      discordTag: "staff#0001",
      queryType: "IP",
      searchTarget: "203.0.113.15",
      resultCount: 2,
      success: true,
    });
    expect(send).toHaveBeenCalledTimes(1);
    const [{ embeds }] = send.mock.calls[0];
    const embedJson = embeds[0].toJSON();
    const fullText = JSON.stringify(embedJson);
    expect(fullText).toContain("203.0.113.xxx");
    expect(fullText).not.toContain("203.0.113.15");
  });

  it("does not mask a username search target", async () => {
    const send = vi.fn();
    const client = {
      channels: { fetch: vi.fn().mockResolvedValue({ isTextBased: () => true, send }) },
    };
    await sendAuditEmbed(client, "audit-channel", {
      discordUserId: "123",
      discordTag: "staff#0001",
      queryType: "USERNAME",
      searchTarget: "ExamplePlayer",
      resultCount: 1,
      success: true,
    });
    const [{ embeds }] = send.mock.calls[0];
    expect(JSON.stringify(embeds[0].toJSON())).toContain("ExamplePlayer");
  });
});
