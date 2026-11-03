import { CreditCard } from "lucide-react";
import { PageHeader, LoadingState, ErrorState } from "@/components/app/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/_core/trpc";
import { formatMoney, formatDate } from "@shared/format";

export default function AdminSubscriptions() {
  const q = trpc.admin.subscriptions.useQuery();
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Subscriptions" description={`${rows.length} subscription(s)`} />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><CreditCard className="mx-auto mb-2 h-6 w-6" /> No subscriptions yet.</div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Business</TableHead><TableHead>Plan</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-navy">{s.businessName ?? "—"}</TableCell>
                  <TableCell><Badge variant="muted">{s.plan}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.billingPeriod}</TableCell>
                  <TableCell><Badge variant={s.status === "ACTIVE" ? "success" : "muted"}>{s.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(s.amount, "₦")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.expiresAt ? formatDate(s.expiresAt) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
