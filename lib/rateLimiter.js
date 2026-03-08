/**
 * Simple in-memory rate limiter for sensitive endpoints.
 * Tracks requests per IP within a sliding window.
 */

const windows = new Map();

/**
 * Creates a Fastify preHandler hook that rate-limits by IP.
 *
 * @param {object} options
 * @param {number} options.windowMs  - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max       - Max requests per window per IP (default: 10)
 * @param {string} [options.message] - Error message to return when limit is exceeded
 * @returns {function} Fastify preHandler hook
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = "Too many requests, please try again later.",
} = {}) {
  const key = `${windowMs}:${max}`;
  if (!windows.has(key)) {
    windows.set(key, new Map());
  }
  const store = windows.get(key);

  // Periodically clean up expired entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of store.entries()) {
      if (now - entry.windowStart >= windowMs) {
        store.delete(ip);
      }
    }
  }, windowMs).unref();

  return async function rateLimitHook(req, res) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now - entry.windowStart >= windowMs) {
      store.set(ip, { windowStart: now, count: 1 });
      return;
    }

    entry.count += 1;

    if (entry.count > max) {
      res.code(429).send({ success: false, message });
    }
  };
}
