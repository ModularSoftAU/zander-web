/**
 * api/mixed/stripeWebhook.js
 *
 * Stripe webhook for Map Token fulfilment.
 *
 *   POST /api/stripe/webhook
 *
 * Handles checkout.session.completed for product_type = map_tokens.
 * Registered in a dedicated plugin scope (in app.js) with a raw-body parser so
 * the HMAC-SHA256 signature can be verified against the exact payload bytes.
 *
 * Idempotency:
 *   - Each Stripe event id is recorded in mixed_stripe_webhook_events; a repeat
 *     delivery is a no-op.
 *   - The token credit is also keyed on the checkout session id (unique index
 *     on mixed_map_token_transactions.stripe_checkout_session_id), so even a
 *     race cannot double-credit.
 */

import crypto from "crypto";
import * as mixed from "../../controllers/mixedController.js";
import { broadcast } from "../../lib/mixedRealtime.js";

function verifyStripeSignature({ signatureHeader, rawPayload, secret }) {
  if (!signatureHeader || !secret) return false;
  let timestamp = null;
  const v1Signatures = [];
  for (const part of signatureHeader.split(",")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key === "t") timestamp = Number(val);
    if (key === "v1") v1Signatures.push(val);
  }
  if (!timestamp || !v1Signatures.length) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > 300) return false;

  const payloadStr = Buffer.isBuffer(rawPayload) ? rawPayload.toString("utf8") : String(rawPayload);
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payloadStr}`).digest("hex");
  return v1Signatures.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, "hex");
      const expBuf = Buffer.from(expected, "hex");
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  });
}

export default function mixedStripeWebhookRoutes(app) {
  app.post("/api/stripe/webhook", async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signatureHeader = req.headers["stripe-signature"];
    const rawPayload = req.body; // Buffer, thanks to the raw content-type parser

    if (!verifyStripeSignature({ signatureHeader, rawPayload, secret })) {
      return res.status(400).send({ success: false, message: "Invalid signature." });
    }

    let event;
    try {
      event = JSON.parse(Buffer.isBuffer(rawPayload) ? rawPayload.toString("utf8") : rawPayload);
    } catch {
      return res.status(400).send({ success: false, message: "Invalid payload." });
    }

    // Acknowledge events we don't handle so Stripe stops retrying.
    if (event.type !== "checkout.session.completed") {
      return res.send({ success: true, ignored: event.type });
    }

    try {
      // Idempotency guard on the Stripe event id.
      const inserted = await mixed.q(
        `INSERT IGNORE INTO mixed_stripe_webhook_events (event_id, type) VALUES (?, ?)`,
        [event.id, event.type]
      );
      if (inserted.affectedRows === 0) {
        return res.send({ success: true, duplicate: true });
      }

      const session = event.data?.object || {};
      const meta = session.metadata || {};
      if (meta.product_type !== "map_tokens") {
        return res.send({ success: true, ignored: "not map_tokens" });
      }

      const uuid = mixed.normaliseUuid(meta.minecraft_uuid);
      const amount = Number.parseInt(meta.token_amount, 10);
      if (!uuid || !(amount > 0)) {
        console.error("[mixed:stripe] invalid metadata", meta);
        return res.send({ success: true, message: "Invalid metadata; nothing credited." });
      }

      const credited = await mixed.creditTokens({
        uuid,
        username: meta.minecraft_username || null,
        amount,
        type: "purchase",
        reason: `Stripe purchase (${amount} Map Tokens)`,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent || null,
        metadata: { zander_user_id: meta.zander_user_id },
      });

      if (credited) {
        broadcast("MAP_TOKENS_CREDITED", { uuid, amount });
        console.log(`[mixed:stripe] Credited ${amount} Map Tokens to ${uuid}`);
      }
      return res.send({ success: true });
    } catch (err) {
      console.error("[mixed:stripe] webhook error", err);
      return res.status(500).send({ success: false, message: "Webhook processing failed." });
    }
  });
}
