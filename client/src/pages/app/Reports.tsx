import { useState } from "react";
import { Download, FileText, TrendingUp, Boxes, Wallet, ShoppingCart } from "lucide-react";
import { PageHeader, StatCard, LoadingState, ErrorState } from "@/components/app/shared";
import { BarChart, DonutChart } from "@/components/charts/Charts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { DATE_FILTERS, PAYMENT_METHOD_LABELS } from "@shared/constants";
import { formatMoney, formatMoneyShort, formatDate, toCsv, downloadCsv } from "@shared/format";

export default function Reports() {
  const { active } = useBusiness();
  const sym = active?.currencySymbol ?? "₦";
  const [filter, setFilter] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const q = trpc.dashboard.reports.useQuery(
    { businessId: active?.businessId ?? "", filter, from: from || undefined, to: to || undefined },
    { enabled: !!active },
  );

  if (!active) return null;
  if (q.isLoading) return <LoadingState label="Building reports…" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const s = d.stats;
  const trendData = d.trend.map((t) => ({ label: t.day.slice(5), value: t.revenue }));
  const catData = d.expenseByCategory.map((c) => ({ label: c.name, value: c.total }));

  function exportSales() {
    const csv = toCsv(["Reference", "Date", "Customer", "Total", "Paid", "Method", "Status"], d.sales.map((x) => [x.reference, formatDate(x.createdAt), x.customerName ?? "Walk-in", x.total / 100, x.amountPaid / 100, PAYMENT_METHOD_LABELS[x.paymentMethod] ?? x.paymentMethod, x.status]));
    downloadCsv(`core-grid-sales-report-${Date.now()}.csv`, csv);
  }
  function exportExpenses() {
    const csv = toCsv(["Date", "Description", "Category", "Amount"], d.expenses.map((x) => [formatDate(x.expenseDate), x.description, x.categoryName ?? "Uncategorised", x.amount / 100]));
    downloadCsv(`core-grid-expense-report-${Date.now()}.csv`, csv);
  }
  function exportInventory() {
    const csv = toCsv(["Product", "SKU", "Qty", "Cost", "Retail", "Stock value"], d.topProducts.map((p) => [p.name, "", p.qty, "", "", p.revenue / 100]));
    downloadCsv(`core-grid-inventory-report-${Date.now()}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={`Business performance · ${formatDate(d.range.from)} – ${formatDate(d.range.to)}`}
        help="Downloadable summaries of your business for any period — useful for your own records, for a bank or for an investor. Choose a period, then export as PDF or Excel."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40">
              {DATE_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
            {filter === "custom" && <><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" /></>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(s.revenue, sym)} hint={`${s.salesCount} sales`} tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Gross profit" value={formatMoney(s.grossProfit, sym)} tone="success" />
        <StatCard label="Net profit" value={formatMoney(s.netProfit, sym)} tone={s.netProfit >= 0 ? "success" : "danger"} />
        <StatCard label="Stock value" value={formatMoney(d.inventory.stockValue, sym)} hint={`${d.inventory.totalUnits} units`} icon={<Boxes className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-semibold text-navy">Revenue trend</h3>
          <div className="mt-4"><BarChart data={trendData} formatValue={(v) => formatMoneyShort(v, sym)} /></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-navy">Expenses by category</h3>
          <div className="mt-4"><DonutChart data={catData} formatValue={(v) => formatMoneyShort(v, sym)} /></div>
        </div>
      </div>

      {/* Top products */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-5">
          <Boxes className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-navy">Top products</h3>
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportInventory} disabled={d.topProducts.length === 0}><Download className="h-4 w-4" /> Export</Button>
        </div>
        {d.topProducts.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No sales in this period.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
            <TableBody>{d.topProducts.map((p, i) => <TableRow key={i}><TableCell className="text-muted-foreground">{i + 1}</TableCell><TableCell className="font-medium text-navy">{p.name}</TableCell><TableCell className="text-right">{p.qty}</TableCell><TableCell className="text-right font-medium">{formatMoney(p.revenue, sym)}</TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </div>

      {/* Sales report */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-5">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-navy">Sales report</h3>
          <Badge variant="muted" className="ml-auto">{d.sales.length} sale(s)</Badge>
          <Button variant="outline" size="sm" onClick={exportSales} disabled={d.sales.length === 0}><Download className="h-4 w-4" /> CSV</Button>
        </div>
        {d.sales.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No sales in this period.</p> : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{d.sales.slice(0, 100).map((x) => <TableRow key={x.id}><TableCell className="font-medium text-navy">{x.reference}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(x.createdAt)}</TableCell><TableCell>{x.customerName ?? "Walk-in"}</TableCell><TableCell className="text-right font-medium">{formatMoney(x.total, sym)}</TableCell><TableCell><Badge variant={x.status === "COMPLETED" ? "success" : "muted"}>{x.status}</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Expense report */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-5">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-navy">Expense report</h3>
          <Badge variant="muted" className="ml-auto">{d.expenses.length} entr(ies)</Badge>
          <Button variant="outline" size="sm" onClick={exportExpenses} disabled={d.expenses.length === 0}><Download className="h-4 w-4" /> CSV</Button>
        </div>
        {d.expenses.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No expenses in this period.</p> : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>{d.expenses.slice(0, 100).map((x) => <TableRow key={x.id}><TableCell className="text-xs text-muted-foreground">{formatDate(x.expenseDate)}</TableCell><TableCell className="font-medium text-navy">{x.description}</TableCell><TableCell>{x.categoryName ?? "—"}</TableCell><TableCell className="text-right font-medium text-destructive">{formatMoney(x.amount, sym)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Reports reflect real data recorded in your business. Use the date filter to change the period.</p>
    </div>
  );
}
