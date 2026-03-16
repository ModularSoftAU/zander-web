/**
 * lib/fastifyPrismaSessionStore.js
 *
 * A minimal Fastify-compatible session store backed by Prisma + MySQL.
 *
 * Why not @quixo3/prisma-session-store?
 * That library wraps every store callback in `setImmediate` (via defer.js).
 * setImmediate fires in Node's "check" phase — after the current I/O cycle.
 * In Fastify's onSend hook pipeline, by the time setImmediate fires, the
 * HTTP response can already be committed via a parallel code path, causing
 * ERR_HTTP_HEADERS_SENT.  This store calls callbacks from Promise microtasks
 * instead, which fire before the next event-loop iteration and don't have
 * that race.
 *
 * set() uses a single atomic `INSERT … ON DUPLICATE KEY UPDATE` so concurrent
 * requests sharing a new session ID can never race into a duplicate-key error.
 */

import { prisma } from "../controllers/databaseController.js";

const DEFAULT_TTL_MS = 86400 * 7 * 1000; // 7 days — matches app.js cookie.maxAge
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // prune expired sessions every 2 min

export class FastifyPrismaSessionStore {
  #cleanupTimer = null;

  constructor() {
    // Background cleanup of expired rows.
    this.#cleanupTimer = setInterval(() => {
      prisma.session
        .deleteMany({ where: { expiresAt: { lt: new Date() } } })
        .catch((err) =>
          console.error("[SessionStore] Expired session cleanup error:", err.message)
        );
    }, CLEANUP_INTERVAL_MS);

    // Don't block process exit.
    if (this.#cleanupTimer.unref) this.#cleanupTimer.unref();
  }

  /** Retrieve a session by its session ID (sid). */
  get(sid, callback) {
    prisma.session
      .findUnique({ where: { sid } })
      .then((row) => {
        if (!row) return callback(null, null);
        if (new Date(row.expiresAt) < new Date()) {
          // Expired — delete async and treat as a miss.
          prisma.session.deleteMany({ where: { sid } }).catch(() => {});
          return callback(null, null);
        }
        try {
          callback(null, JSON.parse(row.data));
        } catch {
          callback(null, null);
        }
      })
      .catch((err) => callback(err));
  }

  /** Persist (create or update) a session. */
  set(sid, session, callback) {
    const ttlMs =
      session?.cookie?.maxAge != null
        ? session.cookie.maxAge
        : DEFAULT_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);

    let data;
    try {
      data = JSON.stringify(session);
    } catch (err) {
      return callback(err);
    }

    // Atomic upsert — safe under concurrent requests.
    prisma
      .$executeRaw`
        INSERT INTO sessions (id, sid, \`data\`, expiresAt)
        VALUES (${sid}, ${sid}, ${data}, ${expiresAt})
        ON DUPLICATE KEY UPDATE
          \`data\`    = VALUES(\`data\`),
          expiresAt = VALUES(expiresAt)
      `
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  /** Extend a session's TTL without changing its data. */
  touch(sid, session, callback) {
    const ttlMs =
      session?.cookie?.maxAge != null
        ? session.cookie.maxAge
        : DEFAULT_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);

    prisma.session
      .updateMany({ where: { sid }, data: { expiresAt } })
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  /** Delete a session. */
  destroy(sid, callback) {
    prisma.session
      .deleteMany({ where: { sid } })
      .then(() => callback(null))
      .catch((err) => callback(err));
  }

  /** Stop the background cleanup timer. */
  close() {
    if (this.#cleanupTimer) {
      clearInterval(this.#cleanupTimer);
      this.#cleanupTimer = null;
    }
  }
}
