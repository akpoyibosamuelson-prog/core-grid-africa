import { useState } from "react";
import { Link } from "wouter";
import { Plus, ShoppingCart, Eye, Ban, Download, Printer } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, ErrorState, SearchInput, Pagination } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";
import { formatMoney, formatDateTime, toCsv, downloadCsv } from "@shared/format";

const PAGE_SIZE = 20;

function statusBadge(s: string) {
  if (s === "COMPLETED") return <Badge variant="success">Completed</Badge>;
  if (s === "CANCELLED") return <Badge variant="destructive">Cancelled</Badge>;
  if (s === "REFUNDED") return <Badge variant="warning">Refunded</Badge>;
  return <Badge variant="muted">{s}</Badge>;
}

function payBadge(s: string) {
  if (s === "PAID") return <Badge variant="success">Paid</Badge>;
  if (s === "PARTIAL") return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="destructive">Unpaid</Badge>;
}

export default function Sales() {
  const { active, isOwnerOrAdmin } = useBusiness();
  const { push } = useToast();
  const sym = active?.currencySymbol ?? "₦";
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<string | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const bizId = active?.businessId ?? "";
  const list = trpc.sale.list.useQuery({ businessId: bizId, search: search || undefined, from: from || undefined, to: to || undefined }, { enabled: !!active });
  const detail = trpc.sale.get.useQuery({ businessId: bizId, id: view ?? "" }, { enabled: !!view });
  const utils = trpc.useUtils();
  const cancelM = trpc.sale.cancel.useMutation({ onSuccess: () => { push({ kind: "success", title: "Sale cancelled", message: "Stock has been restored." }); setCancel(null); setReason(""); void utils.sale.list.invalidate(); void utils.product.list.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not cancel", message: e.message }) });

  if (!active) return null;
  const rows = list.data ?? [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const csv = toCsv(
      ["Reference", "Date", "Customer", "Items", "Total", "Paid", "Balance", "Payment", "Status"],
      rows.map((s) => [s.reference, formatDateTime(s.createdAt), s.customerName ?? "Walk-in", s.itemCount, s.total / 100, s.amountPaid / 100, (s.total - s.amountPaid) / 100, s.paymentMethod, s.status]),
    );
    downloadCsv(`core-grid-sales-${Date.now()}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Every sale, payment and receipt"
        actions={<>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4" /> Export CSV</Button>
          <Button asChild><Link to="/app/pos"><Plus className="h-4 w-4" /> New sale</Link></Button>
        </>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by reference or customer…" className="w-full sm:w-72" />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>

      {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="No sales yet" description="Record your first sale from the POS and it will appear here with a receipt." action={<Button asChild><Link to="/app/pos">Open POS</Link></Button>} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-navy">{s.reference}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell>{s.customerName ?? "Walk-in"}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(s.total, sym)}</TableCell>
                  <TableCell>{payBadge(s.paymentStatus)}</TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setView(s.id)} title="View"><Eye className="h-4 w-4" /></Button>
                      {isOwnerOrAdmin && s.status === "COMPLETED" && <Button variant="ghost" size="sm" onClick={() => setCancel(s.id)} title="Cancel"><Ban className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-4"><Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} /></div>
        </div>
      )}

      <Dialog open={!!view} onClose={() => setView(null)} title="Sale receipt" className="max-w-lg"
        footer={<Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>}>
        {detail.isLoading ? <LoadingState /> : detail.data && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-medium">{detail.data.reference}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Date</span><span>{formatDateTime(detail.data.createdAt)}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Customer</span><span>{detail.data.customerName ?? "Walk-in"}</span></div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {detail.data.items.map((it) => (
                  <TableRow key={it.id}><TableCell>{it.name}</TableCell><TableCell className="text-right">{it.quantity}</TableCell><TableCell className="text-right">{formatMoney(it.unitPrice, sym)}</TableCell><TableCell className="text-right">{formatMoney(it.lineTotal, sym)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(detail.data.subtotal, sym)}</span></div>
              {detail.data.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatMoney(detail.data.discount, sym)}</span></div>}
              {detail.data.tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatMoney(detail.data.tax, sym)}</span></div>}
              <div className="flex justify-between text-base font-bold text-navy"><span>Total</span><span>{formatMoney(detail.data.total, sym)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{formatMoney(detail.data.amountPaid, sym)}</span></div>
              {detail.data.total - detail.data.amountPaid > 0 && <div className="flex justify-between font-medium text-destructive"><span>Balance</span><span>{formatMoney(detail.data.total - detail.data.amountPaid, sym)}</span></div>}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={!!cancel} onClose={() => setCancel(null)} title="Cancel this sale?" description="Stock will be returned to inventory and the sale marked cancelled. This is recorded in the audit log."
        footer={<><Button variant="outline" onClick={() => setCancel(null)}>Keep sale</Button><Button variant="destructive" onClick={() => cancel && cancelM.mutate({ businessId: bizId, id: cancel, reason })} disabled={!reason.trim() || cancelM.isPending}>Cancel sale</Button></>}>
        <div className="space-y-2"><label className="text-sm font-medium">Reason *</label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer returned items…" /></div>
      </Dialog>
    </div>
  );
}
