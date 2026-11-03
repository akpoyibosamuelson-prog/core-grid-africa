import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, AlertTriangle, ExternalLink, Loader2, Receipt } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { PLANS, planPrice, type PlanBillingPeriod } from "@shared/constants";
import { formatMoney } from "@shared/format";
import { cn } from "@/lib/utils";

/**
 * Subscription & payments panel.
 *
 * The browser never decides a price and never marks a payment paid. It asks the
 * server to start a transaction (the server derives the amount from the plan),
 * sends the customer to the provider's hosted checkout, and on return asks the
 * server to VERIFY the reference independently. The outcome shown here is
 * whatever the server's verification returned.
 */
export default function SubscriptionPanel({ businessId, isOwnerOrAdmin }: { businessId: string; isOwnerOrAdmin: boolean }) {
  const { push } = useToast();
  const utils = trpc.useUtils();
  const [period, setPeriod] = useState<PlanBillingPeriod>("MONTHLY");
  const [verifying, setVerifying] = useState(false);

  const config = trpc.payment.config.useQuery();
  const sub = trpc.subscription.current.useQuery({ businessId }, { enabled: !!businessId });
  const history = trpc.payment.history.useQuery({ businessId }, { enabled: !!businessId });

  const initialize = trpc.payment.initialize.useMutation({
    onSuccess: (data) => {
      if (data.authorizationUrl) {
        // Hand off to the provider's hosted checkout. We do NOT mark anything
        // paid here — the return trip triggers a server-side verification.
        window.location.href = data.authorizationUrl;
      } else {
        push({ kind: "error", title: "Could not start payment", message: "The provider did not return a checkout link." });
      }
    },
    onError: (e) => push({ kind: "error", title: "Payment could not start", message: e.message }),
  });

  const verify = trpc.payment.verify.useMutation({
    onSuccess: async (data) => {
      if (data.outcome === "settled") {
        push({ kind: "success", title: "Payment confirmed", message: data.plan ? `Your ${data.plan} plan is now active.` : "Payment confirmed." });
      } else if (data.outcome === "already_settled") {
        push({ kind: "success", title: "Payment already confirmed" });
      } else {
        push({ kind: "error", title: "Payment not completed", message: data.reason ?? "The transaction was not successful." });
      }
      await Promise.all([utils.subscription.current.invalidate(), utils.payment.history.invalidate()]);
    },
    onError: (e) => push({ kind: "error", title: "Could not verify payment", message: e.message }),
  });

  const changePlan = trpc.subscription.change.useMutation({
    onSuccess: async () => {
      push({ kind: "success", title: "Moved to the Free plan" });
      await utils.subscription.current.invalidate();
    },
    onError: (e) => push({ kind: "error", title: "Could not change plan", message: e.message }),
  });

  // On return from the provider, verify the reference SERVER-SIDE. The query
  // string is only a trigger — it is never treated as proof of payment.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference || !businessId) return;
    setVerifying(true);
    verify.mutate(
      { businessId, reference },
      {
        onSettled: () => {
          setVerifying(false);
          // Clean the reference out of the URL so a refresh does not re-verify.
          const url = new URL(window.location.href);
          url.searchParams.delete("reference");
          url.searchParams.delete("trxref");
          window.history.replaceState({}, "", url.toString());
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const currentPlan = sub.data?.plan ?? "FREE";
  const configured = config.data?.configured ?? false;
  const missing = config.data?.missing ?? [];

  const payments = useMemo(() => history.data ?? [], [history.data]);

  return (
    <div className="space-y-5">
      {/* Provider status — honest about what is and is not set up. */}
      {config.isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking payment configuration…
        </div>
      ) : !configured ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-navy">Online payments are not configured yet</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Add {missing.length ? missing.join(", ") : "PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY, APP_URL"} under
              Settings → Environment variables to enable subscription payments. Until then, paid plans cannot be
              purchased — nothing is charged and no transaction is recorded as successful.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
          <Check className="h-4 w-4 text-success" />
          <span className="text-muted-foreground">Payments are configured. Checkout runs through {config.data?.label}.</span>
        </div>
      )}

      {verifying && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm text-navy">
          <Loader2 className="h-4 w-4 animate-spin" /> Verifying your payment with the provider…
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-2xl font-bold text-navy">{currentPlan}</p>
            {sub.data?.expiresAt && (
              <p className="mt-1 text-xs text-muted-foreground">Renews {new Date(sub.data.expiresAt).toLocaleDateString()}</p>
            )}
          </div>
          <Badge variant="primary">{sub.data?.status ?? "ACTIVE"}</Badge>
        </div>
      </div>

      {/* Billing period toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setPeriod("MONTHLY")}
          className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", period === "MONTHLY" ? "bg-primary text-white" : "text-muted-foreground hover:text-navy")}
        >
          Monthly
        </button>
        <button
          onClick={() => setPeriod("ANNUAL")}
          className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", period === "ANNUAL" ? "bg-primary text-white" : "text-muted-foreground hover:text-navy")}
        >
          Annual <span className="text-xs opacity-80">(2 months free)</span>
        </button>
      </div>

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const isCurrent = currentPlan === p.tier;
          const amount = planPrice(p.tier, period) ?? 0;
          const isFree = p.tier === "FREE";
          return (
            <div key={p.tier} className={cn("flex flex-col rounded-xl border bg-card p-5", isCurrent ? "border-primary ring-1 ring-primary" : "border-border")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-navy">{p.name}</h3>
                {isCurrent && <Badge variant="primary">Current</Badge>}
              </div>
              <p className="mt-2 text-2xl font-bold text-navy">
                {isFree ? "Free" : formatMoney(amount, "₦")}
                {!isFree && <span className="text-sm font-normal text-muted-foreground">/{period === "ANNUAL" ? "yr" : "mo"}</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
              <ul className="mt-3 flex-1 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              {isOwnerOrAdmin && !isCurrent && (
                isFree ? (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => changePlan.mutate({ businessId, plan: p.tier, billingPeriod: period })} disabled={changePlan.isPending}>
                    Move to Free
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() => initialize.mutate({ businessId, plan: p.tier, billingPeriod: period })}
                    disabled={initialize.isPending || !configured}
                    title={!configured ? "Add your Paystack keys to enable payments" : undefined}
                  >
                    {initialize.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Pay with Paystack
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Payment history */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-navy">Payment history</h3>
        </div>
        {history.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No payments yet. Subscription payments will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Reference</th>
                  <th className="px-4 py-2 font-medium">Plan</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.reference}</td>
                    <td className="px-4 py-2">{p.plan ?? p.type}</td>
                    <td className="px-4 py-2">{formatMoney(p.amount, "₦")}</td>
                    <td className="px-4 py-2">
                      <Badge variant={p.status === "SUCCESS" ? "success" : p.status === "PENDING" ? "muted" : "destructive"}>
                        {p.status}
                      </Badge>
                      {p.failureReason && <p className="mt-1 text-xs text-muted-foreground">{p.failureReason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3" /> Payments are processed by Paystack. A transaction is only marked paid after
        independent server-side verification — never because you returned from the checkout page.
      </p>
    </div>
  );
}
