import { useState } from "react";
import { Plus, Truck, Eye, Trash2, PackageCheck } from "lucide-react";
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
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@shared/constants";

const PAGE_SIZE = 20;
interface Line { productId?: string; name: string; quantity: number; unitPrice: number; }

function statusBadge(s: string) {
  if (s === "DELIVERED") return <Badge variant="success">Delivered</Badge>;
  if (s === "CANCELLED") return <Badge variant="destructive">Cancelled</Badge>;
  if (s === "SHIPPED") return <Badge variant="primary">Shipped</Badge>;
  if (s === "READY_FOR_PICKUP") return <Badge variant="warning">Ready for pickup</Badge>;
  if (s === "PROCESSING") return <Badge variant="warning">Processing</Badge>;
  if (s === "CONFIRMED") return <Badge variant="primary">Confirmed</Badge>;
  return <Badge variant="muted">Pending</Badge>;
}

function payBadge(s: string) {
  if (s === "PAID") return <Badge variant="success">Paid</Badge>;
  if (s === "PARTIALLY_PAID") return <Badge variant="warning">Partial</Badge>;
  if (s === "REFUNDED") return <Badge variant="muted">Refunded</Badge>;
  return <Badge variant="destructive">Unpaid</Badge>;
}

export default function Orders() {
  const { active, can } = useBusiness();
  const { push } = useToast();
  const sym = active?.currencySymbol ?? "₦";
  const bizId = active?.businessId ?? "";
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [deliveryFor, setDeliveryFor] = useState<string | null>(null);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");

  const list = trpc.order.list.useQuery({ businessId: bizId, status: statusFilter || undefined }, { enabled: !!active });
  const detail = trpc.order.get.useQuery({ businessId: bizId, id: view ?? "" }, { enabled: !!view });
  const customers = trpc.customer.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const prods = trpc.product.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const utils = trpc.useUtils();

  const createM = trpc.order.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Order created" }); setOpen(false); setLines([]); setAmountPaid(0); setNotes(""); setDeliveryAddress(""); setCustomerId(""); void utils.order.list.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not create", message: e.message }) });
  const statusM = trpc.order.updateStatus.useMutation({ onSuccess: () => { push({ kind: "success", title: "Order updated" }); void utils.order.list.invalidate(); void utils.order.get.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not update", message: e.message }) });
  const deliveryM = trpc.order.createDelivery.useMutation({ onSuccess: () => { push({ kind: "success", title: "Delivery created" }); setDeliveryFor(null); setCourier(""); setTracking(""); void utils.order.get.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not create delivery", message: e.message }) });

  if (!active) return null;
  const rows = list.data ?? [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders & Deliveries"
        description="Track every order from pending to delivered"
        help="Use orders when a customer asks for goods to be prepared, picked up or delivered later. Move each order along as it progresses so you always know what is outstanding."
        actions={can("orders") && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New order</Button>}
      />

      <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full sm:w-56">
        <option value="">All statuses</option>
        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
      </Select>

      {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<Truck className="h-6 w-6" />} title="No orders yet" description="Create an order to track fulfilment, payment and delivery." action={can("orders") ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New order</Button> : undefined} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium text-navy">{o.reference}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                  <TableCell>{o.customerName ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(o.total, sym)}</TableCell>
                  <TableCell>{payBadge(o.paymentStatus)}</TableCell>
                  <TableCell>{statusBadge(o.status)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setView(o.id)} title="View"><Eye className="h-4 w-4" /></Button>
                      {can("orders") && <Button variant="ghost" size="sm" onClick={() => setDeliveryFor(o.id)} title="Add delivery"><Truck className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-4"><Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} /></div>
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New order" className="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => createM.mutate({ businessId: bizId, customerId: customerId || undefined, reference: `ORD-${Date.now().toString(36).toUpperCase()}`, items: lines.filter((l) => l.name.trim()), deliveryAddress: deliveryAddress || undefined, amountPaid, notes: notes || undefined })} disabled={lines.filter((l) => l.name.trim()).length === 0 || createM.isPending}>Create order</Button></>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Customer</Label><Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Select customer…</option>{(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Items</Label><Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, { name: "", quantity: 1, unitPrice: 0 }])}><Plus className="h-3.5 w-3.5" /> Add item</Button></div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <div className="col-span-6"><Select value={l.productId ?? ""} onChange={(e) => { const p = (prods.data ?? []).find((x) => x.id === e.target.value); setLines((prev) => prev.map((x, j) => (j === i ? { ...x, productId: e.target.value, name: p?.name ?? x.name, unitPrice: p?.retailPrice ?? x.unitPrice } : x))); }}><option value="">Select product…</option>{(prods.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
                <div className="col-span-2"><Input type="number" min="1" value={l.quantity} onChange={(e) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} /></div>
                <div className="col-span-3"><MoneyInput value={l.unitPrice} onChange={(v) => setLines((prev) => prev.map((x, j) => (j === i ? { ...x, unitPrice: v } : x)))} symbol={sym} /></div>
                <div className="col-span-1 flex items-center"><Button variant="ghost" size="sm" onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </div>
          <div className="space-y-2"><Label>Delivery address</Label><Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Amount paid</Label><MoneyInput value={amountPaid} onChange={setAmountPaid} symbol={sym} /></div>
            <div className="space-y-2"><Label>Total</Label><Input value={formatMoney(total, sym)} readOnly className="bg-muted" /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
      </Dialog>

      <Dialog open={!!view} onClose={() => setView(null)} title="Order details" className="max-w-lg">
        {detail.isLoading ? <LoadingState /> : detail.data && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-medium">{detail.data.reference}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Customer</span><span>{detail.data.customerName ?? "—"}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Payment</span><span>{payBadge(detail.data.paymentStatus)}</span></div>
            </div>
            <div className="space-y-2">
              <Label>Update status</Label>
              <Select value={detail.data.status} onChange={(e) => statusM.mutate({ businessId: bizId, id: detail.data!.id, status: e.target.value })}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{detail.data.items.map((it) => <TableRow key={it.id}><TableCell>{it.name}</TableCell><TableCell className="text-right">{it.quantity}</TableCell><TableCell className="text-right">{formatMoney(it.unitPrice, sym)}</TableCell><TableCell className="text-right">{formatMoney(it.lineTotal, sym)}</TableCell></TableRow>)}</TableBody>
            </Table>
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-navy"><span>Total</span><span>{formatMoney(detail.data.total, sym)}</span></div>
            {detail.data.deliveries.length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-navy"><PackageCheck className="h-4 w-4 text-success" /> Deliveries</p>
                {detail.data.deliveries.map((d) => (
                  <div key={d.id} className="mt-2 text-xs text-muted-foreground">
                    {d.courier ?? "Courier TBD"} · {d.status}{d.trackingNumber ? ` · ${d.trackingNumber}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={!!deliveryFor} onClose={() => setDeliveryFor(null)} title="Create delivery"
        footer={<><Button variant="outline" onClick={() => setDeliveryFor(null)}>Cancel</Button><Button onClick={() => deliveryFor && deliveryM.mutate({ businessId: bizId, orderId: deliveryFor, courier: courier || undefined, trackingNumber: tracking || undefined })} disabled={deliveryM.isPending}>Create delivery</Button></>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Courier</Label><Input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. GIG Logistics" /></div>
          <div className="space-y-2"><Label>Tracking number</Label><Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></div>
        </div>
      </Dialog>
    </div>
  );
}
