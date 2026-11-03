import { useState } from "react";
import { Users } from "lucide-react";
import { PageHeader, LoadingState, ErrorState, SearchInput, Pagination } from "@/components/app/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { formatDate } from "@shared/format";

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = trpc.admin.users.useQuery();
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const all = q.data ?? [];
  const rows = all.filter((u) => !search || (u.email ?? "").toLowerCase().includes(search.toLowerCase()) || (u.name ?? "").toLowerCase().includes(search.toLowerCase()));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description={`${all.length} user account(s)`} />
      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search users…" className="w-full sm:w-80" />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 h-6 w-6" /> No users found.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-navy">{u.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                  <TableCell><Badge variant={u.role === "SUPER_ADMIN" ? "primary" : "muted"}>{u.role}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 pb-4"><Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} /></div>
        </div>
      )}
    </div>
  );
}
