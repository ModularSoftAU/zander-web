import { describe, expect, it, vi } from "vitest";

import { checkRateLimit } from "../../lib/rateLimiter.mjs";

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("checkRateLimit", () => {
  it("trips at `max` requests from one client IP", () => {
    const opts = { windowMs: 60_000, max: 3 };
    const req = { method: "POST", url: "/trip-basic", ip: "10.0.0.1" };

    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(checkRateLimit(req, makeRes(), opts));
    }

    expect(results).toEqual([true, true, true, false]);
  });

  it("ignores a spoofed x-forwarded-for header — same bucket regardless", () => {
    const opts = { windowMs: 60_000, max: 3 };

    // N+1 requests, each with a different attacker-supplied x-forwarded-for,
    // but all from the same real peer (req.ip). The limiter must key on req.ip
    // and still trip at N.
    const results = [];
    for (let i = 0; i < 4; i++) {
      const req = {
        method: "POST",
        url: "/spoof-xff",
        ip: "10.0.0.2",
        headers: { "x-forwarded-for": `203.0.113.${i}` },
      };
      results.push(checkRateLimit(req, makeRes(), opts));
    }

    expect(results).toEqual([true, true, true, false]);
  });
});
