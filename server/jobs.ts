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
import { comparePeriods, debtsReport } from "./analytics";
import { inventoryIntelligence } from "./inventory-intel";
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

// ── Daily business alerts ────────────────────────────────────────────────────
// One sweep per business, once a day: overdue receivables, stock that needs
// reordering, stock about to expire, and a month-on-month sales decline. Each
// alert is created at most once per day per business (guarded by an unread
// check), so a repeated run never spams the same warning.
function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export async function runDailyAlerts(): Promise<void> {
  const businesses = await q.listAllBusinesses();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const { resolveDateRange } = await import("../shared/format");

  for (const biz of businesses) {
    try {
      const [debts, inv] = await Promise.all([
        debtsReport(biz.id),
        inventoryIntelligence(biz.id, 30),
      ]);

      if (debts.totals.overdueReceivable > 0 && !(await q.hasUnreadNotificationSince(biz.id, "DEBT_OVERDUE", dayAgo))) {
        await q.createNotification(biz.id, {
          type: "DEBT_OVERDUE",
          title: "Overdue receivables need chasing",
          message: `${naira(debts.totals.overdueReceivable)} across ${debts.totals.overdueCount} invoice(s) is past its due date.`,
          link: "/app/debts",
        });
      }

      const restock = inv.rows.filter((r) => r.recommendedRestock > 0 && r.classification !== "DEAD");
      if (restock.length > 0 && !(await q.hasUnreadNotificationSince(biz.id, "RESTOCK", dayAgo))) {
        await q.createNotification(biz.id, {
          type: "RESTOCK",
          title: `${restock.length} product(s) need restocking`,
          message: `Top of the list: ${restock.slice(0, 3).map((r) => r.name).join(", ")}.`,
          link: "/app/inventory",
        });
      }

      const expiring = inv.rows.filter((r) => r.expiryDays !== null && r.expiryDays <= 30 && r.quantity > 0);
      if (expiring.length > 0 && !(await q.hasUnreadNotificationSince(biz.id, "EXPIRY", dayAgo))) {
        await q.createNotification(biz.id, {
          type: "EXPIRY",
          title: `${expiring.length} product(s) expiring within 30 days`,
          message: `Act before they become a write-off: ${expiring.slice(0, 3).map((r) => r.name).join(", ")}.`,
          link: "/app/inventory",
        });
      }

      const cur = resolveDateRange("this_month", now);
      const prev = resolveDateRange("last_month", now);
      const cmp = await comparePeriods(biz.id, cur, prev);
      if (cmp.growth.revenue !== null && cmp.growth.revenue < -0.1 && !(await q.hasUnreadNotificationSince(biz.id, "SALES_DECLINE", dayAgo))) {
        await q.createNotification(biz.id, {
          type: "SALES_DECLINE",
          title: "Sales are down on last month",
          message: `Revenue is ${Math.round(Math.abs(cmp.growth.revenue) * 100)}% below the same point last month.`,
          link: "/app/analytics",
        });
      }
    } catch (err) {
      // One business must not stop the sweep.
      // eslint-disable-next-line no-console
      console.error(`[alerts] daily sweep failed for ${biz.id}`, err);
    }
  }
}

registerJob("alerts.daily", runDailyAlerts);
