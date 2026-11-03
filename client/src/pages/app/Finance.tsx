import { useState } from "react";
import { TrendingUp, TrendingDown, Wallet, Download, CreditCard, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PageHeader, StatCard, LoadingState, ErrorState } from "@/components/app/shared";
import { BarChart, DonutChart, LineChart } from "@/components/charts/Charts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { DATE_FILTERS, PAYMENT_METHOD_LABELS } from "@shared/constants";
import { formatMoney, formatMoneyShort, formatDate, toCsv, downloadCsv } from "@shared/format";

export default function Finance() {
  const { active } = useBusiness();
  const sym = active?.currencySymbol ?? "₦";
  const [filter, setFilter] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const q = trpc.dashboard.finance.useQuery(
    { businessId: active?.businessId ?? "", filter, from: from || undefined, to: to || undefined },
    { enabled: !!active },
  );

  if (!active) return null;
  if (q.isLoading) return <LoadingState label="Loading financials…" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const s = d.stats;

  const trendData = d.trend.map((t) => ({ label: t.day.slice(5), value: t.revenue }));
  const catData = d.expenseByCategory.map((c) => ({ label: c.name, value: c.total }));

  function exportPnl() {
    const csv = toCsv(
      ["Metric", "Amount"],
      [
        ["Revenue", s.revenue / 100],
        ["Cost of goods sold", s.cogs / 100],
        ["Gross profit", s.grossProfit / 100],
        ["Expenses", s.expenseTotal / 100],
        ["Net profit", s.netProfit / 100],
        ["Cash collected", s.collected / 100],
        ["Outstanding", s.outstanding / 100],
        ["Receivables", d.receivables / 100],
        ["Payables", d.payables / 100],
      ],
    );
    downloadCsv(`core-grid-finance-${Date.now()}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Management"
        description={`Profit & loss · ${formatDate(d.range.from)} – ${formatDate(d.range.to)}`}
        help="Revenue is what you sold. Gross profit is revenue minus the cost of those goods. Net profit is what is left after expenses too. Cash collected is money actually received — it can differ from revenue when customers buy on credit."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
              {DATE_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
            {filter === "custom" && <><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" /></>}
            <Button variant="outline" onClick={exportPnl}><Download className="h-4 w-4" /> Export P&L</Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(s.revenue, sym)} hint={`${s.salesCount} sales`} tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Cost of goods" value={formatMoney(s.cogs, sym)} hint="What stock cost you" icon={<ArrowDownRight className="h-4 w-4" />} />
        <StatCard label="Gross profit" value={formatMoney(s.grossProfit, sym)} hint={s.revenue > 0 ? `${Math.round((s.grossProfit / s.revenue) * 100)}% margin` : "—"} tone="success" />
        <StatCard label="Net profit" value={formatMoney(s.netProfit, sym)} hint={`After ${formatMoney(s.expenseTotal, sym)} expenses`} tone={s.netProfit >= 0 ? "success" : "danger"} icon={s.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Cash collected" value={formatMoney(s.collected, sym)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Outstanding" value={formatMoney(s.outstanding, sym)} tone="warning" hint="Unpaid on sales" />
        <StatCard label="Receivables" value={formatMoney(d.receivables, sym)} hint="Owed to you" icon={<ArrowUpRight className="h-4 w-4" />} />
        <StatCard label="Payables" value={formatMoney(d.payables, sym)} hint="You owe suppliers" tone="danger" icon={<ArrowDownRight className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold text-navy">Revenue trend</h3>
          <div className="mt-4"><LineChart data={trendData} formatValue={(v) => formatMoneyShort(v, sym)} /></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-navy">Expense breakdown</h3>
          <div className="mt-4"><DonutChart data={catData} formatValue={(v) => formatMoneyShort(v, sym)} /></div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-navy">Daily revenue</h3>
        <div className="mt-4"><BarChart data={trendData} formatValue={(v) => formatMoneyShort(v, sym)} /></div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-5">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-navy">Payments ledger</h3>
          <Badge variant="muted" className="ml-auto">{d.payments.length} record(s)</Badge>
        </div>
        {d.payments.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-navy">{p.reference}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                  <TableCell><Badge variant="muted">{p.type}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</TableCell>
                  <TableCell>{p.status === "SUCCESS" ? <Badge variant="success">Success</Badge> : p.status === "FAILED" ? <Badge variant="destructive">Failed</Badge> : <Badge variant="warning">{p.status}</Badge>}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(p.amount, sym)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
