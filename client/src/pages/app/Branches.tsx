import { useState } from "react";
import { Plus, Building2, Trash2, MapPin, Phone } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, ErrorState, ConfirmDialog } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";
import { PLANS } from "@shared/constants";

export default function Branches() {
  const { active, isOwnerOrAdmin } = useBusiness();
  const { push } = useToast();
  const bizId = active?.businessId ?? "";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const list = trpc.branch.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const utils = trpc.useUtils();
  const createM = trpc.branch.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Branch added" }); setOpen(false); setForm({ name: "", address: "", phone: "" }); void utils.branch.list.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not add", message: e.message }) });
  const deleteM = trpc.branch.remove.useMutation({ onSuccess: () => { push({ kind: "success", title: "Branch removed" }); setToDelete(null); void utils.branch.list.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not remove", message: e.message }) });

  if (!active) return null;
  const rows = list.data ?? [];
  const plan = PLANS.find((p) => p.tier === active.plan);
  const limit = plan?.limits.branches ?? 1;
  const atLimit = limit !== -1 && rows.length >= limit;

  return (
    <div className="space-y-6">
      <PageHeader title="Branches" description="Manage your business locations" actions={isOwnerOrAdmin && <Button onClick={() => setOpen(true)} disabled={atLimit}><Plus className="h-4 w-4" /> Add branch</Button>} />

      {atLimit && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          Your <strong>{plan?.name}</strong> plan allows {limit} branch(es). Upgrade your plan to add more locations.
        </div>
      )}

      {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="No branches" description="Add your business locations to track stock and sales per branch." action={isOwnerOrAdmin ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add branch</Button> : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><Building2 className="h-5 w-5" /></span>
                {b.isDefault && <Badge variant="primary">Main</Badge>}
              </div>
              <h3 className="mt-3 font-semibold text-navy">{b.name}</h3>
              {b.address && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {b.address}</p>}
              {b.phone && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> {b.phone}</p>}
              {isOwnerOrAdmin && !b.isDefault && (
                <Button variant="ghost" size="sm" className="mt-3 text-destructive" onClick={() => setToDelete({ id: b.id, name: b.name })}><Trash2 className="h-4 w-4" /> Remove</Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Add branch"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => form.name.trim() && createM.mutate({ businessId: bizId, name: form.name, address: form.address || undefined, phone: form.phone || undefined })} disabled={createM.isPending}>Add branch</Button></>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Branch name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ikeja Branch" /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && deleteM.mutate({ businessId: bizId, id: toDelete.id })} title={`Remove ${toDelete?.name ?? "branch"}?`} confirmLabel="Remove" destructive busy={deleteM.isPending} />
    </div>
  );
}
