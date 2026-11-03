// ── Payment reconciliation job ────────────────────────────────────────────────
// The backstop for the two ways a payment can be left PENDING:
//   • the customer paid but closed the tab before returning to the app, and
//   • a webhook that never arrived (or arrived while the app was down).
//
// It re-verifies each stale PENDING transaction with the provider and settles
// it through the SAME `fulfilPayment` path everything else uses, so the amount
// check and duplicate guard apply here too.
//
// Registered at import time; the platform fires it via the signed job callback
// (POST /api/_jobs/payments.reconcile). It is safe to run at any frequency —
// a settled payment is skipped, and a still-pending one is simply left alone.
import { registerJob } from "./_core/jobs";
import { activeProvider } from "./services/payments";
import { fulfilPayment } from "./services/payments/fulfill";
import * as q from "./db";

/** Only look at transactions older than this, so we never race a live checkout. */
const MIN_AGE_MS = 2 * 60 * 1000;

export async function reconcilePendingPayments(): Promise<void> {
  const provider = activeProvider();
  if (!provider.isConfigured()) return; // nothing to verify against

  const pending = await q.listPendingProviderPayments(MIN_AGE_MS);
  for (const record of pending) {
    try {
      const result = await provider.verify(record.reference);
      await fulfilPayment(record.reference, result);
    } catch (err) {
      // One bad reference must not stop the sweep.
      // eslint-disable-next-line no-console
      console.error(`[payments] reconcile failed for ${record.reference}`, err);
    }
  }
}

registerJob("payments.reconcile", reconcilePendingPayments);
