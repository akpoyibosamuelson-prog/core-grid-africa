import { useState } from "react";
import { Download, FileSpreadsheet, FileText, HandCoins, Receipt, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader, StatCard, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { formatMoney, formatDate } from "@shared/format";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export";

type DebtRow = {
  id: string;
  reference: string;
  partyName: string | null;
  total: number;
  amountPaid: number;
  balance: number;
  dueAt: Date | string | null;
  createdAt: Date | string;
  daysOverdue: number;
  overdue: boolean;
};

function DebtTable({ rows, sym, emptyLabel }: { rows: DebtRow[]; sym: string; emptyLabel: string }) {
  if (rows.length === 0) {
    return <EmptyState title={emptyLabel} description="Nothing outstanding here right now." icon={<CheckCircle2 className="h-6 w-6" />} />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Party</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium text-navy">{r.reference}</TableCell>
            <TableCell>{r.partyName ?? "—"}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{r.dueAt ? formatDate(r.dueAt) : "No due date"}</TableCell>
            <TableCell className="text-right">{formatMoney(r.total, sym)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{formatMoney(r.amountPaid, sym)}</TableCell>
            <TableCell className="text-right font-semibold">{formatMoney(r.balance, sym)}</TableCell>
            <TableCell>
              {r.overdue ? (
                <Badge variant="destructive">{r.daysOverdue}d overdue</Badge>
              ) : r.dueAt ? (
                <Badge variant="muted">Current</Badge>
              ) : (
                <Badge variant="outline">No due date</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Debts() {
  const { active } = useBusiness();
  const sym = active?.currencySymbol ?? "₦";
  const [tab, setTab] = useState("receivables");

  const q = trpc.debts.report.useQuery({ businessId: active?.businessId ?? "" }, { enabled: !!active });

  if (!active) return null;
  if (q.isLoading) return <LoadingState label="Working out who owes what…" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const t = d.totals;

  const rows = tab === "receivables" ? d.receivables : d.payables;

  function exportCsvFile() {
    exportCsv(
      `core-grid-debts-${Date.now()}.csv`,
      ["Type", "Reference", "Party", "Due date", "Total", "Paid", "Balance", "Days overdue"],
      [
        ...d.receivables.map((r) => ["Receivable", r.reference, r.partyName ?? "", r.dueAt ? formatDate(r.dueAt) : "", r.total / 100, r.amountPaid / 100, r.balance / 100, r.daysOverdue]),
        ...d.payables.map((r) => ["Payable", r.reference, r.partyName ?? "", r.dueAt ? formatDate(r.dueAt) : "", r.total / 100, r.amountPaid / 100, r.balance / 100, r.daysOverdue]),
      ],
    );
  }

  function exportWorkbook() {
    exportExcel(`core-grid-debts-${Date.now()}`, [
      {
        name: "Receivables",
        headers: ["Reference", "Customer", "Due date", "Total (NGN)", "Paid (NGN)", "Balance (NGN)", "Days overdue"],
        rows: d.receivables.map((r) => [r.reference, r.partyName ?? "", r.dueAt ? formatDate(r.dueAt) : "", r.total / 100, r.amountPaid / 100, r.balance / 100, r.daysOverdue]),
      },
      {
        name: "Payables",
        headers: ["Reference", "Supplier", "Due date", "Total (NGN)", "Paid (NGN)", "Balance (NGN)", "Days overdue"],
        rows: d.payables.map((r) => [r.reference, r.partyName ?? "", r.dueAt ? formatDate(r.dueAt) : "", r.total / 100, r.amountPaid / 100, r.balance / 100, r.daysOverdue]),
      },
    ]);
  }

  function exportPdfFile() {
    exportPdf("Core Grid Africa — Debts Report", active?.businessName ?? "", [
      {
        heading: "Summary",
        lines: [
          `Owed to you: ${formatMoney(t.receivable, sym)}`,
          `Overdue receivables: ${formatMoney(t.overdueReceivable, sym)} across ${t.overdueCount} invoice(s)`,
          `You owe suppliers: ${formatMoney(t.payable, sym)}`,
          `Overdue payables: ${formatMoney(t.overduePayable, sym)}`,
        ],
      },
      {
        heading: "Receivables",
        table: {
          headers: ["Reference", "Customer", "Due", "Balance"],
          rows: d.receivables.map((r) => [r.reference, r.partyName ?? "—", r.dueAt ? formatDate(r.dueAt) : "—", formatMoney(r.balance, sym)]),
        },
      },
      {
        heading: "Payables",
        table: {
          headers: ["Reference", "Supplier", "Due", "Balance"],
          rows: d.payables.map((r) => [r.reference, r.partyName ?? "—", r.dueAt ? formatDate(r.dueAt) : "—", formatMoney(r.balance, sym)]),
        },
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debts"
        description="Who owes you, and whom you owe — with overdue ageing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsvFile}><Download className="h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={exportWorkbook}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={exportPdfFile}><FileText className="h-4 w-4" /> PDF</Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Owed to you" value={formatMoney(t.receivable, sym)} hint={`${d.receivables.length} open invoice(s)`} tone="primary" icon={<HandCoins className="h-4 w-4" />} />
        <StatCard label="Overdue receivables" value={formatMoney(t.overdueReceivable, sym)} hint={`${t.overdueCount} past due`} tone={t.overdueReceivable > 0 ? "danger" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="You owe suppliers" value={formatMoney(t.payable, sym)} hint={`${d.payables.length} open bill(s)`} tone="warning" icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="Overdue payables" value={formatMoney(t.overduePayable, sym)} tone={t.overduePayable > 0 ? "warning" : "success"} icon={<Clock className="h-4 w-4" />} />
      </div>

      {t.overdueReceivable > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-navy">{formatMoney(t.overdueReceivable, sym)} is overdue</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              That is cash you have already earned but not collected. Work the overdue list top-down and send a reminder for each.
            </p>
          </div>
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "receivables", label: `Receivables (${d.receivables.length})` },
          { key: "payables", label: `Payables (${d.payables.length})` },
        ]}
      />

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <h3 className="font-semibold text-navy">{tab === "receivables" ? "Customer receivables" : "Supplier payables"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab === "receivables"
              ? "Completed sales with an outstanding balance. Set a due date on credit sales so overdue is measurable."
              : "Purchase orders and received bills with an outstanding balance."}
          </p>
        </div>
        <DebtTable rows={rows} sym={sym} emptyLabel={tab === "receivables" ? "No outstanding receivables" : "No outstanding payables"} />
      </div>
    </div>
  );
}
