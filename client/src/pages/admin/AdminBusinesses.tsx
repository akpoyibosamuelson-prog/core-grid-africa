import { useState } from "react";
import { Building2, Ban, CheckCircle2 } from "lucide-react";
import { PageHeader, LoadingState, ErrorState, SearchInput, Pagination } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@shared/format";

const PAGE_SIZE = 20;

export default function AdminBusinesses() {
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = trpc.admin.businesses.useQuery();
  const utils = trpc.useUtils();
  const setStatus = trpc.admin.setBusinessStatus.useMutation({ onSuccess: () => { push({ kind: "success", title: "Status updated" }); void utils.admin.businesses.invalidate(); }, onError: (e) => push({ kind: "error", title: "Failed", message: e.message }) });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const all = q.data ?? [];
  const rows = all.filter((b) => !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.ownerEmail ?? "").toLowerCase().includes(search.toLowerCase()));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader title="Businesses" description={`${all.length} registered business(es)`} />
      <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or owner email…" className="w-full sm:w-80" />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><Building2 className="mx-auto mb-2 h-6 w-6" /> No businesses found.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Business</TableHead><TableHead>Owner</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {paged.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-navy">{b.name}<div className="text-xs text-muted-foreground">{b.slug}</div></TableCell>
                  <TableCell className="text-sm">{b.ownerName ?? "—"}<div className="text-xs text-muted-foreground">{b.ownerEmail ?? "—"}</div></TableCell>
                  <TableCell><Badge variant="muted">{b.plan}</Badge></TableCell>
                  <TableCell><Badge variant={b.status === "ACTIVE" ? "success" : b.status === "SUSPENDED" ? "destructive" : "warning"}>{b.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(b.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {b.status === "SUSPENDED" ? (
                        <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ businessId: b.id, status: "ACTIVE" })}><CheckCircle2 className="h-4 w-4 text-success" /> Activate</Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ businessId: b.id, status: "SUSPENDED" })}><Ban className="h-4 w-4 text-destructive" /> Suspend</Button>
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
  );
}
