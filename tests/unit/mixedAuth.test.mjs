import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePluginToken, requireLinkedUserOrPlugin } from "../../api/mixed/auth.js";

function createReplyDouble() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
  };
}

describe("requirePluginToken", () => {
  const originalApiKey = process.env.apiKey;

  afterEach(() => {
    process.env.apiKey = originalApiKey;
    vi.restoreAllMocks();
  });

  it("accepts Authorization Bearer tokens", () => {
    process.env.apiKey = "shared-secret";
    const req = { headers: { authorization: "Bearer shared-secret" }, ip: "127.0.0.1" };
    const res = createReplyDouble();

    expect(requirePluginToken(req, res)).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it("accepts legacy x-access-token headers", () => {
    process.env.apiKey = "shared-secret";
    const req = { headers: { "x-access-token": "shared-secret" }, ip: "127.0.0.1" };
    const res = createReplyDouble();

    expect(requirePluginToken(req, res)).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it("rejects non-bearer Authorization headers when no legacy token is provided", () => {
    process.env.apiKey = "shared-secret";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = { headers: { authorization: "shared-secret" }, ip: "127.0.0.1" };
    const res = createReplyDouble();

    expect(requirePluginToken(req, res)).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({
      success: false,
      message: "Invalid or missing API key.",
    });
    expect(warn).toHaveBeenCalledWith(
      "[mixed:auth] Rejected ingestion request from 127.0.0.1: invalid or missing API key (header=authorization-non-bearer)."
    );
  });

  it("returns 503 when no API key is configured", () => {
    process.env.apiKey = "";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const req = { headers: {}, ip: "127.0.0.1" };
    const res = createReplyDouble();

    expect(requirePluginToken(req, res)).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(res.payload).toEqual({
      success: false,
      message: "Mixed plugin API is not configured.",
    });
    expect(error).toHaveBeenCalledWith("[mixed:auth] No API key (apiKey) is configured.");
  });
});

describe("requireLinkedUserOrPlugin", () => {
  const originalApiKey = process.env.apiKey;

  afterEach(() => {
    process.env.apiKey = originalApiKey;
  });

  it("authorises a plugin request and takes identity from the body", () => {
    process.env.apiKey = "shared-secret";
    const req = {
      headers: { authorization: "Bearer shared-secret" },
      body: { uuid: "abc-123", username: "Steve" },
    };
    const res = createReplyDouble();

    const result = requireLinkedUserOrPlugin(req, res);
    expect(result).toEqual({ uuid: "abc-123", username: "Steve", source: "plugin" });
    expect(res.statusCode).toBeNull();
  });

  it("rejects a plugin request missing uuid/username in the body", () => {
    process.env.apiKey = "shared-secret";
    const req = {
      headers: { authorization: "Bearer shared-secret" },
      body: {},
    };
    const res = createReplyDouble();

    expect(requireLinkedUserOrPlugin(req, res)).toBeNull();
    expect(res.statusCode).toBe(400);
  });

  it("authorises a linked web session and takes identity from the session", () => {
    process.env.apiKey = "shared-secret";
    const req = {
      headers: {},
      body: {},
      session: { user: { uuid: "def-456", username: "Alex" } },
    };
    const res = createReplyDouble();

    const result = requireLinkedUserOrPlugin(req, res);
    expect(result).toEqual({ uuid: "def-456", username: "Alex", source: "web" });
  });

  it("rejects an unauthenticated request with neither a token nor a session", () => {
    process.env.apiKey = "shared-secret";
    const req = { headers: {}, body: {} };
    const res = createReplyDouble();

    expect(requireLinkedUserOrPlugin(req, res)).toBeNull();
    expect(res.statusCode).toBe(401);
  });
});
