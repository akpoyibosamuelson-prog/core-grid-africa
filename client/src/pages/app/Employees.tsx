import { useState } from "react";
import { Plus, UserCog, Pencil, Trash2, Shield, Users } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, ErrorState, ConfirmDialog, Pagination } from "@/components/app/shared";
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
import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from "@shared/constants";
import { formatDate } from "@shared/format";

const PAGE_SIZE = 20;
const EMPTY = { name: "", email: "", phone: "", role: "EMPLOYEE" as MemberRole, department: "", hiredAt: "" };

export default function Employees() {
  const { active, isOwnerOrAdmin } = useBusiness();
  const { push } = useToast();
  const bizId = active?.businessId ?? "";
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [memberRole, setMemberRole] = useState<{ id: string; name: string; role: MemberRole } | null>(null);

  const list = trpc.employee.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const members = trpc.employee.listMembers.useQuery({ businessId: bizId }, { enabled: !!active });
  const utils = trpc.useUtils();
  const invalidate = () => { void utils.employee.list.invalidate(); void utils.employee.listMembers.invalidate(); };
  const createM = trpc.employee.create.useMutation({ onSuccess: () => { push({ kind: "success", title: "Employee added" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const updateM = trpc.employee.update.useMutation({ onSuccess: () => { push({ kind: "success", title: "Employee updated" }); setOpen(false); setForm(EMPTY); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not save", message: e.message }) });
  const deleteM = trpc.employee.remove.useMutation({ onSuccess: () => { push({ kind: "success", title: "Employee removed" }); setToDelete(null); invalidate(); }, onError: (e) => push({ kind: "error", title: "Delete failed", message: e.message }) });
  const roleM = trpc.employee.updateMemberRole.useMutation({ onSuccess: () => { push({ kind: "success", title: "Role updated" }); setMemberRole(null); invalidate(); }, onError: (e) => push({ kind: "error", title: "Could not update role", message: e.message }) });

  if (!active) return null;
  const rows = list.data ?? [];
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function submit() {
    if (!form.name.trim()) return;
    const payload = { businessId: bizId, name: form.name, email: form.email || undefined, phone: form.phone || undefined, role: form.role, department: form.department || undefined, hiredAt: form.hiredAt || undefined };
    if (form.id) updateM.mutate({ ...payload, id: form.id });
    else createM.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Employees & Staff" description="Team records and role-based access" actions={isOwnerOrAdmin && <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add employee</Button>} />

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-5">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-navy">Team access</h3>
          <Badge variant="muted" className="ml-auto">{(members.data ?? []).length} member(s)</Badge>
        </div>
        {(members.data ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {(members.data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-navy">{m.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.email ?? "—"}</TableCell>
                  <TableCell><Badge variant="primary">{ROLE_LABELS[m.role as MemberRole] ?? m.role}</Badge></TableCell>
                  <TableCell><Badge variant={m.status === "ACTIVE" ? "success" : "muted"}>{m.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {isOwnerOrAdmin && m.role !== "OWNER" && <Button variant="ghost" size="sm" onClick={() => setMemberRole({ id: m.id, name: m.name ?? "member", role: m.role as MemberRole })}><Pencil className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-navy"><Users className="h-4 w-4 text-primary" /> Employee records</h3>
        {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
          <EmptyState icon={<UserCog className="h-6 w-6" />} title="No employee records" description="Keep staff details, departments and hire dates in one place." action={isOwnerOrAdmin ? <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4" /> Add employee</Button> : undefined} />
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Hired</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {paged.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium text-navy">{e.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.email ?? e.phone ?? "—"}</TableCell>
                    <TableCell><Badge variant="muted">{ROLE_LABELS[e.role as MemberRole] ?? e.role}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.department ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.hiredAt ? formatDate(e.hiredAt) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {isOwnerOrAdmin && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setForm({ id: e.id, name: e.name, email: e.email ?? "", phone: e.phone ?? "", role: e.role as MemberRole, department: e.department ?? "", hiredAt: e.hiredAt ? new Date(e.hiredAt).toISOString().slice(0, 10) : "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setToDelete({ id: e.id, name: e.name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={form.id ? "Edit employee" : "Add employee"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={createM.isPending || updateM.isPending}>{form.id ? "Save changes" : "Add employee"}</Button></>}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Full name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Role</Label><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}>{MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select></div>
            <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Hire date</Label><Input type="date" value={form.hiredAt} onChange={(e) => setForm({ ...form, hiredAt: e.target.value })} /></div>
        </div>
      </Dialog>

      <Dialog open={!!memberRole} onClose={() => setMemberRole(null)} title={`Change role — ${memberRole?.name ?? ""}`}
        footer={<><Button variant="outline" onClick={() => setMemberRole(null)}>Cancel</Button><Button onClick={() => memberRole && roleM.mutate({ businessId: bizId, memberId: memberRole.id, role: memberRole.role })} disabled={roleM.isPending}>Save role</Button></>}>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={memberRole?.role ?? "EMPLOYEE"} onChange={(e) => setMemberRole((m) => (m ? { ...m, role: e.target.value as MemberRole } : m))}>
            {MEMBER_ROLES.filter((r) => r !== "OWNER").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <p className="text-xs text-muted-foreground">Roles control which modules this member can access.</p>
        </div>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => toDelete && deleteM.mutate({ businessId: bizId, id: toDelete.id })} title={`Remove ${toDelete?.name ?? "employee"}?`} confirmLabel="Remove" destructive busy={deleteM.isPending} />
    </div>
  );
}
