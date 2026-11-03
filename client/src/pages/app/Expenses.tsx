import { useState } from "react";
import { Plus, Wallet, Pencil, Trash2, Download, Receipt } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, ErrorState, SearchInput, MoneyInput, ConfirmDialog, Pagination, StatCard } from "@/components/app/shared";
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
import { formatMoney, formatDate, toCsv, downloadCsv } from "@shared/format";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@shared/constants";

const PAGE_SIZE = 20;
const EMPTY = { description: "", amount: 0, categoryId: "", paymentMethod: "CASH", expenseDate: new Date().toISOString().slice(0, 10), notes: "" };

export default function Expenses() {
  const { active, can } = useBusiness();
  const { push } = useToast();
  const sym = active?.currencySymbol ?? "₦";
  const bizId = active?.businessId ?? "";
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

  const list = trpc.expense.list.useQuery({ businessId: bizId, search: search || undefined, from: from || undefined, to: to || undefined }, { enabled: !!active });
  const cats = trpc.category.list.useQuery({ businessId: bizId, kind: "EXPENSE" }, { enabled: !!active });
  const utils = trpc.useUtils();
  const invalidate = () => void utils.expense.list.invalidate();
  const createM = trpc.expense.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Expense recorded" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const updateM = trpc.expense.update.useMutation({ onSuccess: () => { push({ kind: "success", title: "Expense updated" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const deleteM = trpc.expense.remove.useMutation({ onSuccess: () => { push({ kind: "success", title: "Expense deleted" }); setToDelete(null); invalidate(); }, onError: (e) => push({ kind: "error", title: "Delete failed", message: e.message }) });

  if (!active) return null;
  const rows = list.data ?? [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const total = rows.reduce((s, e) => s + e.amount, 0);

  function submit() {
    if (!form.description.trim() || form.amount <= 0) return;
    const payload = { businessId: bizId, description: form.description, amount: form.amount, categoryId: form.categoryId || undefined, paymentMethod: form.paymentMethod as "CASH", expenseDate: form.expenseDate || undefined };
    if (form.id) updateM.mutate({ ...payload, id: form.id });
    else createM.mutate(payload);
  }

  function exportCsv() {
    const csv = toCsv(["Date", "Description", "Category", "Method", "Amount"], rows.map((e) => [formatDate(e.expenseDate), e.description, e.categoryName ?? "Uncategorised", PAYMENT_METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod, e.amount / 100]));
    downloadCsv(`core-grid-expenses-${Date.now()}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Every cost your business incurs"
        help="Record money going out — rent, electricity, transport, salaries, data, marketing. These are subtracted from your profit automatically, so log them as they happen."
        actions={<>

        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}><Download className="h-4 w-4" /> Export CSV</Button>
        {can("expenses") && <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add expense</Button>}
      </>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total expenses" value={formatMoney(total, sym)} tone="danger" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Entries" value={String(rows.length)} icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="Average" value={formatMoney(rows.length ? Math.round(total / rows.length) : 0, sym)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search expenses…" className="w-full sm:w-72" />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>

      {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="No expenses yet" description="Log rent, salaries, transport and other costs to see your true profit." action={can("expenses") ? <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add expense</Button> : undefined} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(e.expenseDate)}</TableCell>
                  <TableCell className="font-medium text-navy">{e.description}</TableCell>
                  <TableCell>{e.categoryName ? <Badge variant="muted">{e.categoryName}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[e.paymentMethod] ?? e.paymentMethod}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{formatMoney(e.amount, sym)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {can("expenses") && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setForm({ id: e.id, description: e.description, amount: e.amount, categoryId: e.categoryId ?? "", paymentMethod: e.paymentMethod, expenseDate: new Date(e.expenseDate).toISOString().slice(0, 10), notes: "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setToDelete({ id: e.id, name: e.description })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Edit expense" : "Add expense"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={createM.isPending || updateM.isPending}>{form.id ? "Save changes" : "Add expense"}</Button></>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Shop rent for November" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Amount *</Label><MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} symbol={sym} /></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Category</Label><Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Uncategorised</option>{(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Payment method</Label><Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</Select></div>
          </div>
          <p className="text-xs text-muted-foreground">Tip: create expense categories like {EXPENSE_CATEGORIES.slice(0, 3).join(", ")} in Settings.</p>
        </div>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && deleteM.mutate({ businessId: bizId, id: toDelete.id })} title={`Delete "${toDelete?.name ?? "expense"}"?`} confirmLabel="Delete" destructive busy={deleteM.isPending} />
    </div>
  );
}
