import { Receipt } from "lucide-react";
import { PageHeader, LoadingState, ErrorState } from "@/components/app/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { formatMoney, formatDateTime } from "@shared/format";

export default function AdminPayments() {
  const q = trpc.admin.payments.useQuery();
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description={`${rows.length} payment record(s)`} />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><Receipt className="mx-auto mb-2 h-6 w-6" /> No payments yet.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Business</TableHead><TableHead>Type</TableHead><TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-navy">{p.reference}</TableCell>
                  <TableCell className="text-sm">{p.businessName ?? "—"}</TableCell>
                  <TableCell><Badge variant="muted">{p.type}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.provider ?? "—"}</TableCell>
                  <TableCell><Badge variant={p.status === "SUCCESS" ? "success" : p.status === "FAILED" ? "destructive" : "warning"}>{p.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(p.amount, "₦")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
