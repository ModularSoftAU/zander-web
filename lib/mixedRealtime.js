/**
 * lib/mixedRealtime.js
 *
 * Lightweight live-update fan-out for the Mixed module.
 *
 * The project does not bundle a WebSocket dependency, so live updates are
 * delivered over Server-Sent Events (SSE) at GET /api/mixed/stream, which works
 * out of the box with Fastify's raw response stream and needs no extra package.
 * The public API and SSE stream together cover the same live surface the spec
 * describes for /ws/mixed: match updates, kill/objective feed, vote updates,
 * server status changes and map-token request updates.
 *
 * broadcast(type, payload) pushes an event to every connected client.
 */

import { EventEmitter } from "events";

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const clients = new Set();

/** Publish a named event to all connected SSE clients. */
export function broadcast(type, payload = {}) {
  const message = `event: ${type}\ndata: ${JSON.stringify({ type, payload, at: Date.now() })}\n\n`;
  for (const res of clients) {
    try {
      res.raw.write(message);
    } catch {
      clients.delete(res);
    }
  }
  emitter.emit("event", { type, payload });
}

/** Register the SSE endpoint on a Fastify instance. */
export function registerMixedStream(app) {
  app.get("/api/mixed/stream", (req, res) => {
    res.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.raw.write(`event: connected\ndata: {"ok":true}\n\n`);
    clients.add(res);

    const keepAlive = setInterval(() => {
      try { res.raw.write(`: ping\n\n`); } catch { /* dropped */ }
    }, 25000);

    req.raw.on("close", () => {
      clearInterval(keepAlive);
      clients.delete(res);
    });
  });
}

export function connectedClientCount() {
  return clients.size;
}
