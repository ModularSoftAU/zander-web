import { describe, it, expect } from "vitest";
import {
  maskIp,
  paginate,
  buildUsernamePageEmbedData,
  buildIpPageEmbedData,
} from "../../lib/discord/ipCheckFormat.mjs";

describe("maskIp", () => {
  it("masks the last octet of an IPv4 address", () => {
    expect(maskIp("203.0.113.15")).toBe("203.0.113.xxx");
  });

  it("masks the last segment of an IPv6 address", () => {
    expect(maskIp("2001:db8::1")).toBe("2001:db8::xxx");
  });

  it("masks the IPv6 zero-compression edge case", () => {
    expect(maskIp("::1")).toBe("::xxx");
  });
});

describe("paginate", () => {
  it("chunks items into pages of the given size", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginate(items, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single empty page for an empty list", () => {
    expect(paginate([], 8)).toEqual([[]]);
  });
});

describe("buildUsernamePageEmbedData", () => {
  it("includes the shared-IP footer and one field per record", () => {
    const page = [
      {
        ip_address: "203.0.113.15",
        first_seen_at: new Date("2026-05-12"),
        last_seen_at: new Date("2026-08-02"),
        session_count: 24,
        otherAccounts: ["SecondPlayer", "ThirdPlayer"],
      },
    ];
    const data = buildUsernamePageEmbedData(page, 0, 1, {
      username: "ExamplePlayer",
      uuid: "00000000-0000-0000-0000-000000000000",
      status: { online: true, server: "survival" },
    });
    expect(data.title).toContain("ExamplePlayer");
    expect(data.footer).toBe(
      "Shared IP addresses are an indicator only. They are not proof that accounts belong to the same person."
    );
    expect(data.fields).toHaveLength(1);
    expect(data.fields[0].name).toBe("203.0.113.15");
    expect(data.fields[0].value).toContain("Sessions: 24");
    expect(data.fields[0].value).toContain("SecondPlayer, ThirdPlayer");
  });

  it("renders 'none' when otherAccounts is empty", () => {
    const page = [
      {
        ip_address: "203.0.113.15",
        first_seen_at: new Date("2026-05-12"),
        last_seen_at: new Date("2026-08-02"),
        session_count: 24,
        otherAccounts: [],
      },
    ];
    const data = buildUsernamePageEmbedData(page, 0, 1, {
      username: "ExamplePlayer",
      uuid: "00000000-0000-0000-0000-000000000000",
      status: { online: false, server: null },
    });
    expect(data.fields).toHaveLength(1);
    expect(data.fields[0].value).toContain("Other accounts: none");
  });

  it("returns empty fields array when page is empty", () => {
    const data = buildUsernamePageEmbedData([], 0, 1, {
      username: "ExamplePlayer",
      uuid: "00000000-0000-0000-0000-000000000000",
      status: { online: true, server: "survival" },
    });
    expect(data.fields).toEqual([]);
  });
});

describe("buildIpPageEmbedData", () => {
  it("includes the shared-IP footer and one field per account", () => {
    const page = [
      {
        uuid: "11111111-1111-1111-1111-111111111111",
        username: "SecondPlayer",
        first_seen_at: new Date("2026-06-18"),
        last_seen_at: new Date("2026-07-28"),
        session_count: 3,
        status: { online: false, server: null },
      },
    ];
    const data = buildIpPageEmbedData(page, 0, 1, "203.0.113.15");
    expect(data.title).toContain("203.0.113.15");
    expect(data.footer).toBe(
      "Shared IP addresses are an indicator only. They are not proof that accounts belong to the same person."
    );
    expect(data.fields[0].name).toBe("SecondPlayer");
    expect(data.fields[0].value).toContain("Sessions: 3");
    expect(data.fields[0].value).toContain("Offline");
  });

  it("returns empty fields array when page is empty", () => {
    const data = buildIpPageEmbedData([], 0, 1, "203.0.113.15");
    expect(data.fields).toEqual([]);
  });
});
