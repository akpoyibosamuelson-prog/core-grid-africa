// ── Provider webhook route ────────────────────────────────────────────────────
// Mounted at POST /api/payments/webhook. This is the ONLY HTTP route the
// payment system adds, and it is deliberately thin: verify the signature, then
// hand the reference to the same fulfilment path the tRPC procedure uses.
//
// Why a raw route rather than a tRPC procedure: the signature is computed over
// the EXACT bytes the provider sent. A JSON body parsed and re-serialised by a
// framework would not reproduce those bytes, so the HMAC would never match.
// Reading `c.req.text()` gives us the untouched body.
//
// A webhook is a TRIGGER, never proof: on `charge.success` we call the provider
// back and verify independently before anything is settled.
import type { Hono } from "hono";
import { activeProvider } from "../services/payments";
import { fulfilPayment } from "../services/payments/fulfill";
import * as q from "../db";

export function registerPaymentWebhook(app: Hono): void {
  app.post("/api/payments/webhook", async (c) => {
    const provider = activeProvider();

    // Not configured ⇒ we cannot verify a signature, so nothing can be trusted.
    if (!provider.isConfigured()) {
      return c.json({ ok: false, error: "payments_not_configured" }, 503);
    }

    const rawBody = await c.req.text();
    const event = await provider.parseWebhook(rawBody, {
      "x-paystack-signature": c.req.header("x-paystack-signature"),
    });
    if (!event) {
      // Invalid or absent signature. Refuse — and say nothing about why.
      return c.json({ ok: false, error: "invalid_signature" }, 401);
    }

    if (!event.reference) return c.json({ ok: true, ignored: true });

    const record = await q.getPaymentByReference(event.reference);
    if (!record) return c.json({ ok: true, ignored: true });

    try {
      if (event.event === "charge.success") {
        const result = await provider.verify(event.reference);
        const outcome = await fulfilPayment(event.reference, result);
        return c.json({ ok: true, outcome: outcome.outcome });
      }
      if (event.event === "charge.failed") {
        await q.markPaymentFailed(event.reference, "Provider reported a failed charge.");
        return c.json({ ok: true, outcome: "failed" });
      }
      return c.json({ ok: true, ignored: true });
    } catch (err) {
      // Answer 500 so the provider retries; the reconciliation job is the
      // backstop if it does not.
      // eslint-disable-next-line no-console
      console.error("[payments] webhook handling failed", err);
      return c.json({ ok: false, error: "processing_failed" }, 500);
    }
  });
}
