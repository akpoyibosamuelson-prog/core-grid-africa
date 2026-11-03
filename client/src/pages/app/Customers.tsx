import { useState } from "react";
import { Plus, Users, Pencil, Trash2, Phone, Mail, TrendingUp, AlertCircle } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, ErrorState, SearchInput, ConfirmDialog, Pagination, StatCard } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@shared/format";

const PAGE_SIZE = 20;
const EMPTY = { name: "", phone: "", email: "", address: "", category: "", notes: "" };
const CATEGORIES = ["Regular", "VIP", "Wholesale", "Retail", "Corporate"];

export default function Customers() {
  const { active, can } = useBusiness();
  const { push } = useToast();
  const sym = active?.currencySymbol ?? "₦";
  const bizId = active?.businessId ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const list = trpc.customer.listWithStats.useQuery({ businessId: bizId, search: search || undefined }, { enabled: !!active });
  const utils = trpc.useUtils();
  const invalidate = () => void utils.customer.listWithStats.invalidate();
  const createM = trpc.customer.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Customer added" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const updateM = trpc.customer.update.useMutation({ onSuccess: () => { push({ kind: "success", title: "Customer updated" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const deleteM = trpc.customer.remove.useMutation({ onSuccess: () => { push({ kind: "success", title: "Customer deleted" }); setToDelete(null); invalidate(); }, onError: (e) => push({ kind: "error", title: "Delete failed", message: e.message }) });

  if (!active) return null;
  const rows = list.data ?? [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalOutstanding = rows.reduce((s, c) => s + (c.outstanding ?? 0), 0);
  const totalSpent = rows.reduce((s, c) => s + (c.totalSpent ?? 0), 0);

  function submit() {
    if (!form.name.trim()) return;
    const payload = { businessId: bizId, name: form.name, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, category: form.category || undefined, notes: form.notes || undefined };
    if (form.id) updateM.mutate({ ...payload, id: form.id });
    else createM.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Profiles, purchase history and outstanding balances" actions={can("customers") && <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add customer</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Customers" value={String(rows.length)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Total spent" value={formatMoney(totalSpent, sym)} tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Outstanding" value={formatMoney(totalOutstanding, sym)} tone="danger" icon={<AlertCircle className="h-4 w-4" />} />
      </div>

      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search customers…" className="w-full sm:w-80" />

      {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title={search ? "No customers match" : "No customers yet"} description={search ? "Try a different search." : "Add customers to track their purchases, balances and history."} action={can("customers") && !search ? <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add customer</Button> : undefined} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Contact</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Purchases</TableHead><TableHead className="text-right">Spent</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><p className="font-medium text-navy">{c.name}</p>{c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {c.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>}
                      {c.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</p>}
                      {!c.phone && !c.email && <span>—</span>}
                    </div>
                  </TableCell>
                  <TableCell>{c.category ? <Badge variant="muted">{c.category}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">{c.orderCount ?? 0}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(c.totalSpent ?? 0, sym)}</TableCell>
                  <TableCell className="text-right">{(c.outstanding ?? 0) > 0 ? <span className="font-medium text-destructive">{formatMoney(c.outstanding, sym)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {can("customers") && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setForm({ id: c.id, name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", category: c.category ?? "", notes: c.notes ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setToDelete({ id: c.id, name: c.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Edit customer" : "Add customer"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={createM.isPending || updateM.isPending}>{form.id ? "Save changes" : "Add customer"}</Button></>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Customer name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-2"><Label>Category</Label><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">None</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && deleteM.mutate({ businessId: bizId, id: toDelete.id })} title={`Delete ${toDelete?.name ?? "customer"}?`} confirmLabel="Delete" destructive busy={deleteM.isPending} />
    </div>
  );
}
