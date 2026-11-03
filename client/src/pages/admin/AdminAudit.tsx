import { ScrollText } from "lucide-react";
import { PageHeader, LoadingState, ErrorState } from "@/components/app/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { formatDateTime } from "@shared/format";

export default function AdminAudit() {
  const q = trpc.admin.auditLogs.useQuery();
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description={`${rows.length} recent action(s)`} />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><ScrollText className="mx-auto mb-2 h-6 w-6" /> No audit entries yet.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Business</TableHead><TableHead>User</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-navy">{a.action}</TableCell>
                  <TableCell><Badge variant="muted">{a.entity}</Badge></TableCell>
                  <TableCell className="text-sm">{a.businessName ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.userEmail ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
