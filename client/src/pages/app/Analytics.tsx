import { useState } from "react";
import {
  TrendingUp, Download, FileSpreadsheet, FileText, Wallet, Boxes,
  Users, AlertTriangle, ArrowUpRight, ArrowDownRight, Banknote, PackageX, Clock,
} from "lucide-react";
import { PageHeader, StatCard, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
import { BarChart, LineChart, DonutChart } from "@/components/charts/Charts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { DATE_FILTERS, PAYMENT_METHOD_LABELS } from "@shared/constants";
import { formatMoney, formatMoneyShort, formatDate } from "@shared/format";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export";

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <Badge variant="muted">new</Badge>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-success" : "text-destructive"}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(value * 100).toFixed(1)}%
    </span>
  );
}

export default function Analytics() {
  const { active } = useBusiness();
  const sym = active?.currencySymbol ?? "₦";
  const [filter, setFilter] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState("performance");

  const input = { businessId: active?.businessId ?? "", filter, from: from || undefined, to: to || undefined };
  const q = trpc.analytics.overview.useQuery(input, { enabled: !!active });
  const pnl = trpc.analytics.pnl.useQuery(input, { enabled: !!active && tab === "pnl" });
  const inv = trpc.analytics.inventory.useQuery(
    { businessId: active?.businessId ?? "", windowDays: 30 },
    { enabled: !!active && tab === "inventory" },
  );

  if (!active) return null;
  if (q.isLoading) return <LoadingState label="Crunching your numbers…" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const m = d.metrics;
  const g = d.comparison.growth;
  const trend = d.series.map((s) => ({ label: s.bucket.slice(5), value: s.revenue }));
  const profitTrend = d.series.map((s) => ({ label: s.bucket.slice(5), value: s.profit }));
  const balanceData = d.balances.balances.map((b) => ({ label: PAYMENT_METHOD_LABELS[b.method] ?? b.method, value: Math.max(0, b.balance) }));

  const periodLabel = `${formatDate(d.range.from)} – ${formatDate(d.range.to)}`;

  function exportSummaryCsv() {
    exportCsv(
      `core-grid-analytics-${Date.now()}.csv`,
      ["Metric", "Value (NGN)"],
      [
        ["Revenue", m.revenue / 100],
        ["Cost of goods sold", m.cogs / 100],
        ["Gross profit", m.grossProfit / 100],
        ["Gross margin %", (m.grossMargin * 100).toFixed(1)],
        ["Expenses", m.expenses / 100],
        ["Net profit", m.netProfit / 100],
        ["Net margin %", (m.netMargin * 100).toFixed(1)],
        ["Cash collected", m.cashCollected / 100],
        ["Outstanding", m.outstanding / 100],
        ["Receivables", m.receivables / 100],
        ["Payables", m.payables / 100],
        ["Inventory value", m.inventoryValue / 100],
        ["Sales count", m.salesCount],
        ["Average sale value", m.avgSaleValue / 100],
      ],
    );
  }

  function exportWorkbook() {
    exportExcel(`core-grid-analytics-${Date.now()}`, [
      {
        name: "Summary",
        headers: ["Metric", "Value (NGN)"],
        rows: [
          ["Revenue", m.revenue / 100],
          ["COGS", m.cogs / 100],
          ["Gross profit", m.grossProfit / 100],
          ["Expenses", m.expenses / 100],
          ["Net profit", m.netProfit / 100],
          ["Cash collected", m.cashCollected / 100],
          ["Receivables", m.receivables / 100],
          ["Payables", m.payables / 100],
        ],
      },
      {
        name: "Trend",
        headers: ["Period", "Revenue (NGN)", "Profit (NGN)", "Sales"],
        rows: d.series.map((s) => [s.bucket, s.revenue / 100, s.profit / 100, s.n]),
      },
      {
        name: "Cash & bank",
        headers: ["Method", "Inflow (NGN)", "Outflow (NGN)", "Balance (NGN)"],
        rows: d.balances.balances.map((b) => [PAYMENT_METHOD_LABELS[b.method] ?? b.method, b.inflow / 100, b.outflow / 100, b.balance / 100]),
      },
      {
        name: "Top customers",
        headers: ["Customer", "Spend (NGN)", "Purchases"],
        rows: d.activity.topCustomers.map((c) => [c.name ?? "—", c.total / 100, c.n]),
      },
    ]);
  }

  function exportPdfReport() {
    exportPdf("Core Grid Africa — Business Analytics", `${active?.businessName ?? ""} · ${periodLabel}`, [
      {
        heading: "Profit & loss",
        lines: [
          `Revenue: ${formatMoney(m.revenue, sym)}`,
          `Cost of goods sold: ${formatMoney(m.cogs, sym)}`,
          `Gross profit: ${formatMoney(m.grossProfit, sym)} (${(m.grossMargin * 100).toFixed(1)}%)`,
          `Expenses: ${formatMoney(m.expenses, sym)}`,
          `Net profit: ${formatMoney(m.netProfit, sym)} (${(m.netMargin * 100).toFixed(1)}%)`,
        ],
      },
      {
        heading: "Cash flow",
        lines: [
          `Cash in: ${formatMoney(d.cash.inflow, sym)}`,
          `Cash out: ${formatMoney(d.cash.outflow, sym)}`,
          `Net cash flow: ${formatMoney(d.cash.net, sym)}`,
        ],
      },
      {
        heading: "Position",
        lines: [
          `Receivables (owed to you): ${formatMoney(m.receivables, sym)}`,
          `Payables (you owe): ${formatMoney(m.payables, sym)}`,
          `Inventory value: ${formatMoney(m.inventoryValue, sym)}`,
        ],
      },
      {
        heading: "Revenue trend",
        table: {
          headers: ["Period", "Revenue", "Profit", "Sales"],
          rows: d.series.map((s) => [s.bucket, formatMoney(s.revenue, sym), formatMoney(s.profit, sym), s.n]),
        },
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Business intelligence · ${periodLabel}`}
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
            <Button variant="outline" size="sm" onClick={exportSummaryCsv}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={exportWorkbook}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={exportPdfReport}><FileText className="h-4 w-4" /> PDF</Button>
          </div>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "performance", label: "Performance" },
          { key: "pnl", label: "Profit & loss" },
          { key: "cash", label: "Cash flow" },
          { key: "customers", label: "Customers" },
          { key: "inventory", label: "Inventory" },
        ]}
      />

      {tab === "performance" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Revenue" value={formatMoney(m.revenue, sym)} hint={`${m.salesCount} sales`} tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
            <StatCard label="Gross profit" value={formatMoney(m.grossProfit, sym)} hint={`${(m.grossMargin * 100).toFixed(1)}% margin`} tone="success" />
            <StatCard label="Net profit" value={formatMoney(m.netProfit, sym)} hint={`${(m.netMargin * 100).toFixed(1)}% margin`} tone={m.netProfit >= 0 ? "success" : "danger"} />
            <StatCard label="Cash collected" value={formatMoney(m.cashCollected, sym)} hint={`${formatMoney(m.outstanding, sym)} outstanding`} icon={<Banknote className="h-4 w-4" />} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Revenue vs last period", value: g.revenue },
              { label: "Gross profit vs last period", value: g.grossProfit },
              { label: "Net profit vs last period", value: g.netProfit },
              { label: "Sales count vs last period", value: g.salesCount },
            ].map((x) => (
              <div key={x.label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{x.label}</p>
                <div className="mt-2"><GrowthBadge value={x.value} /></div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
              <h3 className="font-semibold text-navy">Revenue trend</h3>
              <div className="mt-4"><BarChart data={trend} formatValue={(v) => formatMoneyShort(v, sym)} /></div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-navy">Profit trend</h3>
              <div className="mt-4"><LineChart data={profitTrend} formatValue={(v) => formatMoneyShort(v, sym)} /></div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-navy">Cash & bank position</h3>
              <p className="mt-1 text-xs text-muted-foreground">Derived from recorded transactions, by payment method.</p>
              <div className="mt-4">
                {balanceData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <DonutChart data={balanceData} formatValue={(v) => formatMoneyShort(v, sym)} />
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-navy">Position</h3>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Receivables (owed to you)", value: m.receivables, tone: "text-primary" },
                  { label: "Payables (you owe)", value: m.payables, tone: "text-warning" },
                  { label: "Inventory value", value: m.inventoryValue, tone: "text-navy" },
                  { label: "Net cash flow this period", value: d.cash.net, tone: d.cash.net >= 0 ? "text-success" : "text-destructive" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <span className="text-sm text-muted-foreground">{r.label}</span>
                    <span className={`text-sm font-semibold ${r.tone}`}>{formatMoney(r.value, sym)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "pnl" && (
        <>
          {pnl.isLoading ? <LoadingState label="Building your P&L…" /> : pnl.isError ? <ErrorState message={pnl.error.message} onRetry={() => pnl.refetch()} /> : (
            <>
              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border p-5">
                  <h3 className="font-semibold text-navy">Profit & loss statement</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{periodLabel}</p>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { label: "Revenue", value: pnl.data!.metrics.revenue, bold: false },
                    { label: "Less: cost of goods sold", value: -pnl.data!.metrics.cogs, bold: false },
                    { label: "Gross profit", value: pnl.data!.metrics.grossProfit, bold: true },
                    { label: "Less: operating expenses", value: -pnl.data!.metrics.expenses, bold: false },
                    { label: "Net profit", value: pnl.data!.metrics.netProfit, bold: true },
                  ].map((r) => (
                    <div key={r.label} className={`flex items-center justify-between px-5 py-3 ${r.bold ? "bg-muted/40" : ""}`}>
                      <span className={r.bold ? "font-semibold text-navy" : "text-sm text-muted-foreground"}>{r.label}</span>
                      <span className={`font-semibold ${r.value < 0 ? "text-destructive" : r.bold ? "text-navy" : "text-foreground"}`}>
                        {formatMoney(r.value, sym)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Gross margin" value={`${(pnl.data!.metrics.grossMargin * 100).toFixed(1)}%`} tone="success" />
                <StatCard label="Net margin" value={`${(pnl.data!.metrics.netMargin * 100).toFixed(1)}%`} tone={pnl.data!.metrics.netMargin >= 0 ? "success" : "danger"} />
                <StatCard label="Expense ratio" value={pnl.data!.metrics.revenue > 0 ? `${((pnl.data!.metrics.expenses / pnl.data!.metrics.revenue) * 100).toFixed(1)}%` : "—"} tone="warning" />
              </div>

              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border p-5">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <h3 className="font-semibold text-navy">Unusually large expenses</h3>
                  <Badge variant="muted" className="ml-auto">{pnl.data!.unusual.length}</Badge>
                </div>
                {pnl.data!.unusual.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No expenses stand out from their category norm this period.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Category norm</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {pnl.data!.unusual.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium text-navy">{u.description}</TableCell>
                          <TableCell>{u.categoryName ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-destructive">{formatMoney(u.amount, sym)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatMoney(u.mean, sym)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === "cash" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Cash in" value={formatMoney(d.cash.inflow, sym)} tone="success" icon={<ArrowUpRight className="h-4 w-4" />} />
            <StatCard label="Cash out" value={formatMoney(d.cash.outflow, sym)} tone="danger" icon={<ArrowDownRight className="h-4 w-4" />} />
            <StatCard label="Net cash flow" value={formatMoney(d.cash.net, sym)} tone={d.cash.net >= 0 ? "success" : "danger"} />
            <StatCard label="Total balance" value={formatMoney(d.balances.total, sym)} icon={<Wallet className="h-4 w-4" />} />
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-5">
              <h3 className="font-semibold text-navy">Cash flow statement</h3>
              <p className="mt-1 text-xs text-muted-foreground">{periodLabel}</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { label: "Cash received from sales", value: d.cash.inflow },
                { label: "Paid for purchases", value: -d.cash.purchaseOut },
                { label: "Paid for expenses", value: -d.cash.expenseOut },
                { label: "Net cash flow", value: d.cash.net, bold: true },
              ].map((r) => (
                <div key={r.label} className={`flex items-center justify-between px-5 py-3 ${r.bold ? "bg-muted/40" : ""}`}>
                  <span className={r.bold ? "font-semibold text-navy" : "text-sm text-muted-foreground"}>{r.label}</span>
                  <span className={`font-semibold ${r.value < 0 ? "text-destructive" : r.bold ? "text-navy" : "text-success"}`}>{formatMoney(r.value, sym)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-5"><h3 className="font-semibold text-navy">Balances by payment method</h3></div>
            {d.balances.balances.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.balances.balances.map((b) => (
                    <TableRow key={b.method}>
                      <TableCell className="font-medium text-navy">{PAYMENT_METHOD_LABELS[b.method] ?? b.method}</TableCell>
                      <TableCell className="text-right text-success">{formatMoney(b.inflow, sym)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatMoney(b.outflow, sym)}</TableCell>
                      <TableCell className={`text-right font-semibold ${b.balance >= 0 ? "text-navy" : "text-destructive"}`}>{formatMoney(b.balance, sym)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      {tab === "customers" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Active customers" value={String(d.activity.activeCustomers)} icon={<Users className="h-4 w-4" />} />
            <StatCard label="New this period" value={String(d.activity.newCustomers)} tone="primary" />
            <StatCard label="Returning" value={String(d.activity.returningCustomers)} tone="success" />
          </div>
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-5"><h3 className="font-semibold text-navy">Top customers by spend</h3></div>
            {d.activity.topCustomers.length === 0 ? (
              <EmptyState title="No customer sales yet" description="Once you record sales against customers, your best buyers appear here." icon={<Users className="h-6 w-6" />} />
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Purchases</TableHead><TableHead className="text-right">Spend</TableHead></TableRow></TableHeader>
                <TableBody>
                  {d.activity.topCustomers.map((c, i) => (
                    <TableRow key={c.customerId ?? i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-navy">{c.name ?? "—"}</TableCell>
                      <TableCell className="text-right">{c.n}</TableCell>
                      <TableCell className="text-right font-semibold">{formatMoney(c.total, sym)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      {tab === "inventory" && (
        <>
          {inv.isLoading ? <LoadingState label="Analysing stock movement…" /> : inv.isError ? <ErrorState message={inv.error.message} onRetry={() => inv.refetch()} /> : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Stock value" value={formatMoney(inv.data!.summary.stockValue, sym)} hint={`${inv.data!.summary.totalProducts} products`} icon={<Boxes className="h-4 w-4" />} />
                <StatCard label="Fast moving" value={String(inv.data!.summary.fastMoving)} tone="success" />
                <StatCard label="Dead stock" value={String(inv.data!.summary.deadStock)} hint={formatMoney(inv.data!.summary.deadStockValue, sym)} tone="danger" icon={<PackageX className="h-4 w-4" />} />
                <StatCard label="Needs restock" value={String(inv.data!.summary.needsRestock)} tone="warning" />
              </div>

              <div className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border p-5">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-navy">Restock recommendations</h3>
                  <Badge variant="muted" className="ml-auto">last {inv.data!.summary.windowDays} days</Badge>
                </div>
                {inv.data!.rows.filter((r) => r.recommendedRestock > 0).length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Every product has enough stock for its current demand.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Class</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Days left</TableHead><TableHead className="text-right">Order</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {inv.data!.rows.filter((r) => r.recommendedRestock > 0).slice(0, 25).map((r) => (
                        <TableRow key={r.productId}>
                          <TableCell className="font-medium text-navy">{r.name}</TableCell>
                          <TableCell><Badge variant={r.classification === "FAST" ? "success" : r.classification === "DEAD" ? "destructive" : "muted"}>{r.classification}</Badge></TableCell>
                          <TableCell className="text-right">{r.quantity} {r.unit}</TableCell>
                          <TableCell className="text-right">{r.unitsSold}</TableCell>
                          <TableCell className="text-right">{r.daysOfStock ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">{r.recommendedRestock}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {inv.data!.rows.some((r) => r.expiryDays !== null && r.expiryDays <= 30) && (
                <div className="rounded-xl border border-warning/40 bg-warning/5 p-5">
                  <h3 className="flex items-center gap-2 font-semibold text-navy"><AlertTriangle className="h-4 w-4 text-warning" /> Expiring within 30 days</h3>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {inv.data!.rows.filter((r) => r.expiryDays !== null && r.expiryDays <= 30).map((r) => (
                      <li key={r.productId} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{r.name} · {r.quantity} {r.unit}</span>
                        <span className="font-medium text-warning">{r.expiryDays! <= 0 ? "expired" : `${r.expiryDays} days`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
