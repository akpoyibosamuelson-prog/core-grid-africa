import { useState } from "react";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Wallet, ShoppingCart, Boxes, Users, AlertTriangle,
  ArrowRight, Package, Receipt, BarChart3, Plus,
} from "lucide-react";
import { PageHeader, StatCard, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
import { BarChart, DonutChart } from "@/components/charts/Charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { DATE_FILTERS } from "@shared/constants";
import { formatMoney, formatMoneyShort, formatDate } from "@shared/format";

export default function Overview() {
  const { active } = useBusiness();
  const [filter, setFilter] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const sym = active?.currencySymbol ?? "₦";

  const q = trpc.dashboard.stats.useQuery(
    { businessId: active?.businessId ?? "", filter, from: from || undefined, to: to || undefined },
    { enabled: !!active },
  );

  if (!active) return null;
  if (q.isLoading) return <LoadingState label="Loading dashboard…" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const s = d.stats;

  const trendData = d.trend.map((t) => ({ label: t.day.slice(5), value: t.revenue }));
  const catData = d.expenseByCategory.map((c) => ({ label: c.name, value: c.total }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Overview"
        description={`${active.businessName} · ${formatDate(d.range.from)} – ${formatDate(d.range.to)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
              {DATE_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
            {filter === "custom" && (
              <>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
              </>
            )}
            <Button asChild><Link to="/app/pos"><Plus className="h-4 w-4" /> New sale</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(s.revenue, sym)} hint={`${s.salesCount} sales`} icon={<TrendingUp className="h-4 w-4" />} tone="primary" />
        <StatCard label="Gross profit" value={formatMoney(s.grossProfit, sym)} hint={`COGS ${formatMoney(s.cogs, sym)}`} icon={<BarChart3 className="h-4 w-4" />} tone="success" />
        <StatCard label="Net profit" value={formatMoney(s.netProfit, sym)} hint={`Expenses ${formatMoney(s.expenseTotal, sym)}`} icon={s.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} tone={s.netProfit >= 0 ? "success" : "danger"} />
        <StatCard label="Cash collected" value={formatMoney(s.collected, sym)} hint={`Outstanding ${formatMoney(s.outstanding, sym)}`} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Receivables" value={formatMoney(d.receivables, sym)} hint="Owed to you" icon={<Receipt className="h-4 w-4" />} tone="warning" />
        <StatCard label="Payables" value={formatMoney(d.payables, sym)} hint="You owe suppliers" icon={<Package className="h-4 w-4" />} tone="danger" />
        <StatCard label="Stock value" value={formatMoney(s.inventory.stockValue, sym)} hint={`${s.inventory.totalUnits} units`} icon={<Boxes className="h-4 w-4" />} />
        <StatCard label="New customers" value={String(s.newCustomers)} hint={`${s.expenseCount} expenses logged`} icon={<Users className="h-4 w-4" />} />
      </div>

      {(s.inventory.lowStock > 0 || s.inventory.outOfStock > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <p className="text-sm font-medium text-foreground">
            {s.inventory.outOfStock > 0 && <span>{s.inventory.outOfStock} product(s) out of stock. </span>}
            {s.inventory.lowStock > 0 && <span>{s.inventory.lowStock} product(s) running low.</span>}
          </p>
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link to="/app/inventory">Review inventory <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-navy">Revenue trend</h3>
            <Badge variant="muted">{d.trend.length} day(s)</Badge>
          </div>
          <div className="mt-4">
            <BarChart data={trendData} formatValue={(v) => formatMoneyShort(v, sym)} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-navy">Expenses by category</h3>
          <div className="mt-4">
            <DonutChart data={catData} formatValue={(v) => formatMoneyShort(v, sym)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold text-navy">Top products</h3>
          {d.topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No sales in this period yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {d.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-navy">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} sold</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-navy">{formatMoney(p.revenue, sym)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-navy">Quick actions</h3>
          <div className="mt-4 space-y-2">
            {[
              { to: "/app/pos", label: "Record a sale", icon: ShoppingCart },
              { to: "/app/inventory", label: "Add a product", icon: Boxes },
              { to: "/app/expenses", label: "Log an expense", icon: Wallet },
              { to: "/app/customers", label: "Add a customer", icon: Users },
              { to: "/app/reports", label: "View reports", icon: BarChart3 },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.to} to={a.to} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-navy transition-colors hover:border-primary/30 hover:bg-accent">
                  <Icon className="h-4 w-4 text-primary" /> {a.label}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {s.salesCount === 0 && s.expenseCount === 0 && (
        <EmptyState
          title="Your dashboard is ready"
          description="Record your first sale or add products to your inventory and your real numbers will appear here."
          action={<Button asChild><Link to="/app/pos">Record your first sale</Link></Button>}
        />
      )}
    </div>
  );
}
