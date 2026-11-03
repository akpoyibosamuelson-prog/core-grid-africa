// ── Payment fulfilment ────────────────────────────────────────────────────────
// The ONE place a provider's verification result is turned into a settled
// payment. Both the `payment.verify` procedure (customer returns from checkout)
// and the webhook route call this, so the rules cannot drift between the two
// paths that can settle a transaction.
//
// The rules, in order:
//   1. The reference must exist on OUR side. An unknown reference is ignored.
//   2. A record already SUCCESS is never touched again — this is the duplicate
//      guard at the application layer; the guarded PENDING→SUCCESS UPDATE in
//      db.ts is the one that holds under concurrency.
//   3. The provider must report "success". Anything else is recorded as
//      FAILED/ABANDONED with the provider's own reason.
//   4. The amount the provider SETTLED must equal the amount we recorded. A
//      mismatch is a hard failure — never a rounding tolerance.
//   5. Only then is the payment marked verified, and a subscription (if this
//      was one) activated.
import * as q from "../../db";
import type { PlanBillingPeriod } from "../../../shared/constants";
import type { VerifyResult } from "./types";

export type FulfilOutcome =
  | "settled"
  | "already_settled"
  | "failed"
  | "abandoned"
  | "amount_mismatch"
  | "unknown_reference";

export interface FulfilResult {
  outcome: FulfilOutcome;
  businessId?: string;
  plan?: string;
  expiresAt?: Date;
  reason?: string;
}

export async function fulfilPayment(reference: string, result: VerifyResult): Promise<FulfilResult> {
  const record = await q.getPaymentByReference(reference);
  if (!record) return { outcome: "unknown_reference" };

  // (2) Already settled — a repeat verification or a late webhook. Nothing to do.
  if (record.status === "SUCCESS") {
    return { outcome: "already_settled", businessId: record.businessId };
  }

  // (3) Not a success at the provider.
  if (result.status !== "success") {
    if (result.status === "abandoned") {
      await q.markPaymentAbandoned(reference, result.reason);
      return { outcome: "abandoned", businessId: record.businessId, reason: result.reason };
    }
    await q.markPaymentFailed(reference, result.reason, result.meta);
    await q.createNotification(record.businessId, {
      type: "PAYMENT_FAILED",
      title: "Payment failed",
      message: result.reason ?? `Reference ${reference} was not completed.`,
      link: "/app/settings?tab=subscription",
    });
    return { outcome: "failed", businessId: record.businessId, reason: result.reason };
  }

  // (4) Amount must match what we recorded. The provider settles in the
  // smallest unit (kobo), the same unit we store, so this is an exact compare.
  if (typeof result.amount === "number" && result.amount !== record.amount) {
    await q.markPaymentFailed(
      reference,
      `Amount mismatch: expected ${record.amount}, provider settled ${result.amount}.`,
      result.meta,
    );
    return { outcome: "amount_mismatch", businessId: record.businessId };
  }

  // (5) Settle. The guarded UPDATE returns null if another request won the race.
  const settled = await q.markPaymentVerified(reference, result.providerRef ?? "", result.meta);
  if (!settled) {
    return { outcome: "already_settled", businessId: record.businessId };
  }

  let expiresAt: Date | undefined;
  if (record.type === "SUBSCRIPTION" && record.plan && record.billingPeriod) {
    const { expiresAt: exp } = await q.activateSubscription(record.businessId, {
      plan: record.plan,
      billingPeriod: record.billingPeriod as PlanBillingPeriod,
      amount: record.amount,
      providerRef: result.providerRef,
    });
    expiresAt = exp;
  }

  await q.createNotification(record.businessId, {
    type: "PAYMENT",
    title: "Payment successful",
    message: record.plan
      ? `Your ${record.plan} subscription is now active.`
      : `Payment of reference ${reference} was confirmed.`,
    link: "/app/settings?tab=subscription",
  });

  return {
    outcome: "settled",
    businessId: record.businessId,
    plan: record.plan ?? undefined,
    expiresAt,
  };
}
