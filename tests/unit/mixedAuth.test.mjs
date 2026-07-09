import { afterEach, describe, expect, it, vi } from "vitest";
import { requirePluginToken } from "../../api/mixed/auth.js";

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
  const originalMixedToken = process.env.MIXED_PLUGIN_API_TOKEN;
  const originalApiKey = process.env.apiKey;

  afterEach(() => {
    process.env.MIXED_PLUGIN_API_TOKEN = originalMixedToken;
    process.env.apiKey = originalApiKey;
    vi.restoreAllMocks();
  });

  it("accepts Authorization Bearer tokens", () => {
    process.env.MIXED_PLUGIN_API_TOKEN = "mixed-secret";
    process.env.apiKey = "";
    const req = { headers: { authorization: "Bearer mixed-secret" }, ip: "127.0.0.1" };
    const res = createReplyDouble();

    expect(requirePluginToken(req, res)).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it("accepts legacy x-access-token headers", () => {
    process.env.MIXED_PLUGIN_API_TOKEN = "mixed-secret";
    process.env.apiKey = "";
    const req = { headers: { "x-access-token": "mixed-secret" }, ip: "127.0.0.1" };
    const res = createReplyDouble();

    expect(requirePluginToken(req, res)).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it("accepts the global apiKey as a fallback token value", () => {
    process.env.MIXED_PLUGIN_API_TOKEN = "";
    process.env.apiKey = "global-secret";
    const req = { headers: { authorization: "Bearer global-secret" }, ip: "127.0.0.1" };
    const res = createReplyDouble();

    expect(requirePluginToken(req, res)).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it("rejects non-bearer Authorization headers when no legacy token is provided", () => {
    process.env.MIXED_PLUGIN_API_TOKEN = "mixed-secret";
    process.env.apiKey = "";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = { headers: { authorization: "mixed-secret" }, ip: "127.0.0.1" };
    const res = createReplyDouble();

    expect(requirePluginToken(req, res)).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({
      success: false,
      message: "Invalid or missing plugin API token.",
    });
    expect(warn).toHaveBeenCalledWith(
      "[mixed:auth] Rejected ingestion request from 127.0.0.1: invalid or missing plugin token (header=authorization-non-bearer)."
    );
  });

  it("returns 503 when no plugin token is configured", () => {
    process.env.MIXED_PLUGIN_API_TOKEN = "";
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
    expect(error).toHaveBeenCalledWith("[mixed:auth] No plugin ingestion token is configured.");
  });
});
