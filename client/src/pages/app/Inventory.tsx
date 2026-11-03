import { useState } from "react";
import { Plus, Boxes, AlertTriangle, Pencil, Trash2, ArrowUpDown, History } from "lucide-react";
import { PageHeader, StatCard, EmptyState, LoadingState, ErrorState, SearchInput, MoneyInput, ConfirmDialog, Pagination } from "@/components/app/shared";
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
const EMPTY = { name: "", categoryId: "", supplierId: "", sku: "", barcode: "", unit: "pcs", costPrice: 0, wholesalePrice: 0, retailPrice: 0, quantity: 0, minStockLevel: 0, location: "" };

export default function Inventory() {
  const { active, can } = useBusiness();
  const { push } = useToast();
  const sym = active?.currencySymbol ?? "₦";
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [open, setOpen] = useState(false);
  const [adjust, setAdjust] = useState<{ id: string; name: string } | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [movementsFor, setMovementsFor] = useState<{ id: string; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const bizId = active?.businessId ?? "";
  const products = trpc.product.list.useQuery({ businessId: bizId, search: search || undefined, lowStockOnly: lowOnly || undefined }, { enabled: !!active });
  const summary = trpc.product.summary.useQuery({ businessId: bizId }, { enabled: !!active });
  const cats = trpc.category.list.useQuery({ businessId: bizId, kind: "PRODUCT" }, { enabled: !!active });
  const sups = trpc.supplier.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const movements = trpc.product.movements.useQuery({ businessId: bizId, productId: movementsFor?.id }, { enabled: !!movementsFor });

  const utils = trpc.useUtils();
  const invalidate = () => { void utils.product.list.invalidate(); void utils.product.summary.invalidate(); };
  const createM = trpc.product.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Product added" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const updateM = trpc.product.update.useMutation({ onSuccess: () => { push({ kind: "success", title: "Product updated" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const adjustM = trpc.product.adjustStock.useMutation({ onSuccess: () => { push({ kind: "success", title: "Stock adjusted" }); setAdjust(null); setAdjustDelta(0); setAdjustReason(""); invalidate(); }, onError: (e) => push({ kind: "error", title: "Adjustment failed", message: e.message }) });
  const deleteM = trpc.product.remove.useMutation({ onSuccess: () => { push({ kind: "success", title: "Product deleted" }); setToDelete(null); invalidate(); }, onError: (e) => push({ kind: "error", title: "Delete failed", message: e.message }) });

  if (!active) return null;
  const rows = products.data ?? [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const s = summary.data;

  function submit() {
    if (!form.name.trim()) return;
    const payload = { businessId: bizId, ...form, categoryId: form.categoryId || undefined, supplierId: form.supplierId || undefined, sku: form.sku || undefined, barcode: form.barcode || undefined, location: form.location || undefined };
    if (form.id) updateM.mutate({ ...payload, id: form.id });
    else createM.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Products, stock levels and movement history"
        actions={can("inventory") && <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add product</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value={String(s?.totalProducts ?? 0)} icon={<Boxes className="h-4 w-4" />} />
        <StatCard label="Stock value" value={formatMoney(s?.stockValue ?? 0, sym)} hint={`${s?.totalUnits ?? 0} units`} tone="primary" />
        <StatCard label="Low stock" value={String(s?.lowStock ?? 0)} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Out of stock" value={String(s?.outOfStock ?? 0)} tone="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, SKU or barcode…" className="w-full sm:w-80" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="h-4 w-4 rounded border-input" />
          Low stock only
        </label>
      </div>

      {products.isLoading ? <LoadingState /> : products.isError ? <ErrorState message={products.error.message} onRetry={() => products.refetch()} /> : rows.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title={search || lowOnly ? "No products match" : "No products yet"}
          description={search || lowOnly ? "Try a different search or clear the filter." : "Add your first product to start tracking stock, sales and profit."}
          action={can("inventory") && !search && !lowOnly ? <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add product</Button> : undefined}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Retail</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium text-navy">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.categoryName ?? "Uncategorised"}{p.location ? ` · ${p.location}` : ""}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.costPrice, sym)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(p.retailPrice, sym)}</TableCell>
                  <TableCell className="text-right">{p.quantity} {p.unit}</TableCell>
                  <TableCell>
                    {p.quantity <= 0 ? <Badge variant="destructive">Out of stock</Badge> : p.quantity <= p.minStockLevel ? <Badge variant="warning">Low</Badge> : <Badge variant="success">In stock</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setMovementsFor({ id: p.id, name: p.name })} title="History"><History className="h-4 w-4" /></Button>
                      {can("inventory") && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setAdjust({ id: p.id, name: p.name })} title="Adjust stock"><ArrowUpDown className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setForm({ id: p.id, name: p.name, categoryId: p.categoryId ?? "", supplierId: p.supplierId ?? "", sku: p.sku ?? "", barcode: p.barcode ?? "", unit: p.unit, costPrice: p.costPrice, wholesalePrice: p.wholesalePrice, retailPrice: p.retailPrice, quantity: p.quantity, minStockLevel: p.minStockLevel, location: p.location ?? "" }); setOpen(true); }} title="Edit"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setToDelete({ id: p.id, name: p.name })} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-4"><Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} /></div>
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Edit product" : "Add product"} className="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={createM.isPending || updateM.isPending}>{form.id ? "Save changes" : "Add product"}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>Product name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Indomie Chicken 70g" /></div>
          <div className="space-y-2"><Label>Category</Label><Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Uncategorised</option>{(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
          <div className="space-y-2"><Label>Supplier</Label><Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">None</option>{(sups.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
          <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          <div className="space-y-2"><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
          <div className="space-y-2"><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs, carton, kg" /></div>
          <div className="space-y-2"><Label>Stock location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Shelf A / Main store" /></div>
          <div className="space-y-2"><Label>Cost price</Label><MoneyInput value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} symbol={sym} /></div>
          <div className="space-y-2"><Label>Wholesale price</Label><MoneyInput value={form.wholesalePrice} onChange={(v) => setForm({ ...form, wholesalePrice: v })} symbol={sym} /></div>
          <div className="space-y-2"><Label>Retail price</Label><MoneyInput value={form.retailPrice} onChange={(v) => setForm({ ...form, retailPrice: v })} symbol={sym} /></div>
          <div className="space-y-2"><Label>Quantity in stock</Label><Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
          <div className="space-y-2"><Label>Minimum stock level</Label><Input type="number" min="0" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: Number(e.target.value) })} /></div>
        </div>
      </Dialog>

      <Dialog open={!!adjust} onClose={() => setAdjust(null)} title={`Adjust stock — ${adjust?.name ?? ""}`} description="Positive to add stock, negative to remove. Every adjustment is recorded."
        footer={<><Button variant="outline" onClick={() => setAdjust(null)}>Cancel</Button><Button onClick={() => adjust && adjustM.mutate({ businessId: bizId, productId: adjust.id, delta: adjustDelta, reason: adjustReason })} disabled={!adjustReason.trim() || adjustM.isPending}>Apply adjustment</Button></>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Change in quantity</Label><Input type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(Number(e.target.value))} placeholder="e.g. 10 or -3" /></div>
          <div className="space-y-2"><Label>Reason *</Label><Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Stock count, damage, return…" /></div>
        </div>
      </Dialog>

      <Dialog open={!!movementsFor} onClose={() => setMovementsFor(null)} title={`Stock history — ${movementsFor?.name ?? ""}`} className="max-w-2xl">
        {movements.isLoading ? <LoadingState /> : (movements.data ?? []).length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No movements recorded yet.</p> : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Change</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
              <TableBody>
                {(movements.data ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                    <TableCell><Badge variant="muted">{m.type}</Badge></TableCell>
                    <TableCell className={`text-right font-medium ${m.quantityDelta >= 0 ? "text-success" : "text-destructive"}`}>{m.quantityDelta >= 0 ? "+" : ""}{m.quantityDelta}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Dialog>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && deleteM.mutate({ businessId: bizId, id: toDelete.id })} title={`Delete ${toDelete?.name ?? "product"}?`} description="This removes the product and its movement history." confirmLabel="Delete" destructive busy={deleteM.isPending} />
    </div>
  );
}
