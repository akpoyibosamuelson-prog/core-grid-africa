import { useState, useEffect } from "react";
import { Building2, CreditCard, Bell, Shield, Check, Plus, Trash2, Palette } from "lucide-react";
import { PageHeader, LoadingState, ConfirmDialog } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";
import { EXPENSE_CATEGORIES } from "@shared/constants";
import SubscriptionPanel from "@/components/app/SubscriptionPanel";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "business", label: "Business profile", icon: Building2 },
  { key: "categories", label: "Categories", icon: Palette },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "security", label: "Security", icon: Shield },
];

export default function Settings() {
  const { active, isOwnerOrAdmin, refetch } = useBusiness();
  const { push } = useToast();
  const [tab, setTab] = useState("business");
  const bizId = active?.businessId ?? "";

  const current = trpc.business.current.useQuery({ businessId: bizId }, { enabled: !!active });
  const cats = trpc.category.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const utils = trpc.useUtils();

  const [form, setForm] = useState({ name: "", industry: "", phone: "", email: "", address: "", city: "", state: "", currency: "NGN", currencySymbol: "₦", taxRate: 0, receiptFooter: "" });
  useEffect(() => {
    if (current.data) {
      const b = current.data.business;
      setForm({ name: b.name, industry: b.industry ?? "", phone: b.phone ?? "", email: b.email ?? "", address: b.address ?? "", city: b.city ?? "", state: b.state ?? "", currency: b.currency, currencySymbol: b.currencySymbol, taxRate: b.taxRate, receiptFooter: b.receiptFooter ?? "" });
    }
  }, [current.data]);

  const updateM = trpc.business.update.useMutation({ onSuccess: async () => { push({ kind: "success", title: "Business updated" }); await refetch(); void utils.business.current.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const [newCat, setNewCat] = useState({ name: "", kind: "PRODUCT" });
  const createCat = trpc.category.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Category added" }); setNewCat({ name: "", kind: "PRODUCT" }); void utils.category.list.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not add", message: e.message }) });
  const [catToDelete, setCatToDelete] = useState<{ id: string; name: string } | null>(null);
  const deleteCat = trpc.category.remove.useMutation({ onSuccess: () => { push({ kind: "success", title: "Category removed" }); setCatToDelete(null); void utils.category.list.invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not remove", message: e.message }) });

  if (!active) return null;
  if (current.isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Business profile, categories, subscription and security" />

      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors", tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-navy")}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "business" && (
        <div className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="space-y-2"><Label>Business name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!isOwnerOrAdmin} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} disabled={!isOwnerOrAdmin} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!isOwnerOrAdmin} /></div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!isOwnerOrAdmin} /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!isOwnerOrAdmin} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} disabled={!isOwnerOrAdmin} /></div>
            <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} disabled={!isOwnerOrAdmin} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Currency</Label><Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} disabled={!isOwnerOrAdmin}><option value="NGN">NGN (₦)</option><option value="GHS">GHS (₵)</option><option value="KES">KES (KSh)</option><option value="ZAR">ZAR (R)</option><option value="USD">USD ($)</option></Select></div>
            <div className="space-y-2"><Label>Default tax rate (%)</Label><Input type="number" step="0.01" value={form.taxRate / 100} onChange={(e) => setForm({ ...form, taxRate: Math.round(Number(e.target.value) * 100) })} disabled={!isOwnerOrAdmin} /></div>
          </div>
          <div className="space-y-2"><Label>Receipt footer</Label><Input value={form.receiptFooter} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })} placeholder="Thank you for your business!" disabled={!isOwnerOrAdmin} /></div>
          {isOwnerOrAdmin && <Button onClick={() => updateM.mutate({ businessId: bizId, ...form })} disabled={updateM.isPending}>Save changes</Button>}
        </div>
      )}

      {tab === "categories" && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-navy">Add a category</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="Category name" className="flex-1" />
              <Select value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value })} className="w-40"><option value="PRODUCT">Product</option><option value="EXPENSE">Expense</option></Select>
              <Button onClick={() => newCat.name.trim() && createCat.mutate({ businessId: bizId, name: newCat.name, kind: newCat.kind })} disabled={createCat.isPending}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Suggested expense categories: {EXPENSE_CATEGORIES.slice(0, 5).join(", ")}…</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-navy">Your categories</h3>
            {(cats.data ?? []).length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No categories yet.</p> : (
              <div className="mt-3 flex flex-wrap gap-2">
                {(cats.data ?? []).map((c) => (
                  <span key={c.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
                    {c.name} <Badge variant="muted">{c.kind}</Badge>
                    <button onClick={() => setCatToDelete({ id: c.id, name: c.name })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "subscription" && <SubscriptionPanel businessId={bizId} isOwnerOrAdmin={isOwnerOrAdmin} />}

      {tab === "security" && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="flex items-center gap-2 font-semibold text-navy"><Shield className="h-4 w-4 text-primary" /> Security & data isolation</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Passwords are hashed with bcrypt — never stored in plain text.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Every request is scoped to your business — data cannot leak between businesses.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Role-based permissions control which modules each team member can access.</li>
              <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Sensitive actions are written to an audit log.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="flex items-center gap-2 font-semibold text-navy"><Bell className="h-4 w-4 text-primary" /> Notifications</h3>
            <p className="mt-2 text-sm text-muted-foreground">You receive in-app alerts for sales, low stock, orders and payments. Visit the Notifications page to review them.</p>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!catToDelete} onClose={() => setCatToDelete(null)} onConfirm={() => catToDelete && deleteCat.mutate({ businessId: bizId, id: catToDelete.id })} title={`Delete ${catToDelete?.name ?? "category"}?`} confirmLabel="Delete" destructive busy={deleteCat.isPending} />
    </div>
  );
}
