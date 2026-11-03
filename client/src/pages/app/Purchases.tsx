import { useState } from "react";
import { Plus, Package, Eye, CheckCircle2, Trash2 } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, ErrorState, MoneyInput, Pagination } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";
import { formatMoney, formatDate } from "@shared/format";

const PAGE_SIZE = 20;
interface Line { productId?: string; name: string; quantity: number; unitCost: number; }

function statusBadge(s: string) {
  if (s === "RECEIVED") return <Badge variant="success">Received</Badge>;
  if (s === "ORDERED") return <Badge variant="warning">Ordered</Badge>;
  if (s === "CANCELLED") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="muted">Draft</Badge>;
}

export default function Purchases() {
  const { active, can } = useBusiness();
  const { push } = useToast();
  const sym = active?.currencySymbol ?? "₦";
  const bizId = active?.businessId ?? "";
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [status, setStatus] = useState("DRAFT");
  const [notes, setNotes] = useState("");

  const list = trpc.purchase.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const detail = trpc.purchase.get.useQuery({ businessId: bizId, id: view ?? "" }, { enabled: !!view });
  const sups = trpc.supplier.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const prods = trpc.product.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const utils = trpc.useUtils();

  const createM = trpc.purchase.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Purchase created" }); setOpen(false); setLines([]); setAmountPaid(0); setNotes(""); setSupplierId(""); void utils.purchase.list.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const receiveM = trpc.purchase.receive.useMutation({ onSuccess: () => { push({ kind: "success", title: "Purchase received", message: "Stock has been increased." }); void utils.purchase.list.invalidate(); void utils.product.list.invalidate(); void utils.product.summary.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not receive", message: e.message }) });

  if (!active) return null;
  const rows = list.data ?? [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

  function addLine() { setLines((p) => [...p, { name: "", quantity: 1, unitCost: 0 }]); }
  function pickProduct(idx: number, productId: string) {
    const p = (prods.data ?? []).find((x) => x.id === productId);
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, productId, name: p?.name ?? l.name, unitCost: p?.costPrice ?? l.unitCost } : l)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Purchase orders and supplier stock intake"
        help="Record stock you buy from suppliers. When you mark a purchase as received, the quantities are added to your inventory and any unpaid balance is tracked as money you owe."
        actions={can("purchases") && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New purchase</Button>}
      />

      {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6" />} title="No purchases yet" description="Record a purchase from a supplier. Receiving it increases your stock automatically." action={can("purchases") ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New purchase</Button> : undefined} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-navy">{p.reference}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                  <TableCell>{p.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(p.total, sym)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.total - p.amountPaid, sym)}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setView(p.id)} title="View"><Eye className="h-4 w-4" /></Button>
                      {can("purchases") && p.status !== "RECEIVED" && p.status !== "CANCELLED" && <Button variant="ghost" size="sm" onClick={() => receiveM.mutate({ businessId: bizId, id: p.id })} title="Receive"><CheckCircle2 className="h-4 w-4 text-success" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-4"><Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} /></div>
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New purchase" className="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => createM.mutate({ businessId: bizId, supplierId: supplierId || undefined, reference: `PO-${Date.now().toString(36).toUpperCase()}`, items: lines.filter((l) => l.name.trim()), amountPaid, status: status as "DRAFT", notes: notes || undefined })} disabled={lines.filter((l) => l.name.trim()).length === 0 || createM.isPending}>Create purchase</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Supplier</Label><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">None</option>{(sups.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Status</Label><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="DRAFT">Draft</option><option value="ORDERED">Ordered</option><option value="RECEIVED">Received (adds stock)</option></Select></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Items</Label><Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5" /> Add item</Button></div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-6"><Select value={l.productId ?? ""} onChange={(e) => pickProduct(i, e.target.value)}><option value="">Select product…</option>{(prods.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
                <div className="col-span-2"><Input type="number" min="1" value={l.quantity} onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} /></div>
                <div className="col-span-3"><MoneyInput value={l.unitCost} onChange={(v) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, unitCost: v } : x)))} symbol={sym} /></div>
                <div className="col-span-1 flex items-center"><Button variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Amount paid</Label><MoneyInput value={amountPaid} onChange={setAmountPaid} symbol={sym} /></div>
            <div className="space-y-2"><Label>Total</Label><Input value={formatMoney(total, sym)} readOnly className="bg-muted" /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
      </Dialog>

      <Dialog open={!!view} onClose={() => setView(null)} title="Purchase details" className="max-w-lg">
        {detail.isLoading ? <LoadingState /> : detail.data && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-medium">{detail.data.reference}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Supplier</span><span>{detail.data.supplierName ?? "—"}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Status</span><span>{statusBadge(detail.data.status)}</span></div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{detail.data.items.map((it) => <TableRow key={it.id}><TableCell>{it.name}</TableCell><TableCell className="text-right">{it.quantity}</TableCell><TableCell className="text-right">{formatMoney(it.unitCost, sym)}</TableCell><TableCell className="text-right">{formatMoney(it.lineTotal, sym)}</TableCell></TableRow>)}</TableBody>
            </Table>
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-navy"><span>Total</span><span>{formatMoney(detail.data.total, sym)}</span></div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
