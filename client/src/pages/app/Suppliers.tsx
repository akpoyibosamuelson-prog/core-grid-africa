import { useState } from "react";
import { Plus, Factory, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, ErrorState, SearchInput, ConfirmDialog, Pagination } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@shared/format";

const PAGE_SIZE = 20;
const EMPTY = { name: "", contactName: "", phone: "", email: "", address: "", notes: "" };

export default function Suppliers() {
  const { active, can } = useBusiness();
  const { push } = useToast();
  const sym = active?.currencySymbol ?? "₦";
  const bizId = active?.businessId ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const list = trpc.supplier.list.useQuery({ businessId: bizId, search: search || undefined }, { enabled: !!active });
  const utils = trpc.useUtils();
  const invalidate = () => void utils.supplier.list.invalidate();
  const createM = trpc.supplier.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Supplier added" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const updateM = trpc.supplier.update.useMutation({ onSuccess: () => { push({ kind: "success", title: "Supplier updated" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const deleteM = trpc.supplier.remove.useMutation({ onSuccess: () => { push({ kind: "success", title: "Supplier deleted" }); setToDelete(null); invalidate(); }, onError: (e) => push({ kind: "error", title: "Delete failed", message: e.message }) });

  if (!active) return null;
  const rows = list.data ?? [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function submit() {
    if (!form.name.trim()) return;
    const payload = { businessId: bizId, name: form.name, contactName: form.contactName || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined };
    if (form.id) updateM.mutate({ ...payload, id: form.id });
    else createM.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Your supplier registry and outstanding balances"
        help="The businesses you buy stock from. Keep their contact details here and see at a glance how much you still owe each one."
        actions={can("suppliers") && <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add supplier</Button>}
      />

      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search suppliers…" className="w-full sm:w-80" />

      {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<Factory className="h-6 w-6" />} title={search ? "No suppliers match" : "No suppliers yet"} description={search ? "Try a different search." : "Add the businesses you buy from to track purchases and what you owe."} action={can("suppliers") && !search ? <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add supplier</Button> : undefined} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Purchases</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><p className="font-medium text-navy">{s.name}</p>{s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {s.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone}</p>}
                      {s.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {s.email}</p>}
                      {!s.phone && !s.email && <span>—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatMoney(s.totalPurchases ?? 0, sym)}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{formatMoney(s.outstanding ?? 0, sym)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {can("suppliers") && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setForm({ id: s.id, name: s.name, contactName: s.contactName ?? "", phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", notes: s.notes ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setToDelete({ id: s.id, name: s.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Edit supplier" : "Add supplier"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={createM.isPending || updateM.isPending}>{form.id ? "Save changes" : "Add supplier"}</Button></>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Supplier name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Contact person</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && deleteM.mutate({ businessId: bizId, id: toDelete.id })} title={`Delete ${toDelete?.name ?? "supplier"}?`} confirmLabel="Delete" destructive busy={deleteM.isPending} />
    </div>
  );
}
