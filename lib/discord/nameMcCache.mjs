// lib/discord/nameMcCache.mjs
export function createNameMcCache({ cacheTtlMs, minIntervalMs }) {
  const cache = new Map(); // key -> { value, expiresAt }
  const inFlight = new Map(); // key -> Promise
  let lastCallStartedAt = 0;
  let throttleQueue = Promise.resolve();

  function key(username) {
    return username.toLowerCase();
  }

  function getCached(username) {
    const entry = cache.get(key(username));
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      cache.delete(key(username));
      return undefined;
    }
    return entry.value;
  }

  function setCached(username, value) {
    cache.set(key(username), { value, expiresAt: Date.now() + cacheTtlMs });
  }

  function dedupe(username, fn) {
    const k = key(username);
    if (inFlight.has(k)) {
      return inFlight.get(k);
    }
    const promise = fn().finally(() => inFlight.delete(k));
    inFlight.set(k, promise);
    return promise;
  }

  function throttle(fn) {
    const scheduled = throttleQueue.then(async () => {
      const now = Date.now();
      const wait = Math.max(0, lastCallStartedAt + minIntervalMs - now);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      lastCallStartedAt = Date.now();
      return fn();
    });
    // Chain the queue on the settled promise (ignore its result/error for scheduling purposes).
    throttleQueue = scheduled.then(
      () => undefined,
      () => undefined
    );
    return scheduled;
  }

  return { getCached, setCached, dedupe, throttle };
}
