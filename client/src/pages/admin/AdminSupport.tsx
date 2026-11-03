import { LifeBuoy } from "lucide-react";
import { PageHeader, LoadingState, ErrorState } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/_core/trpc";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@shared/format";

export default function AdminSupport() {
  const { push } = useToast();
  const q = trpc.admin.support.useQuery();
  const utils = trpc.useUtils();
  const setStatus = trpc.admin.updateSupportStatus.useMutation({ onSuccess: () => { push({ kind: "success", title: "Status updated" }); void utils.admin.support.invalidate(); }, onError: (e) => push({ kind: "error", title: "Failed", message: e.message }) });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Support Requests" description={`${rows.length} request(s)`} />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><LifeBuoy className="mx-auto mb-2 h-6 w-6" /> No support requests.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{r.subject}</p>
                  <p className="text-xs text-muted-foreground">{r.email ?? "—"} · {formatDateTime(r.createdAt)}</p>
                </div>
                <Badge variant={r.status === "OPEN" ? "warning" : r.status === "IN_PROGRESS" ? "primary" : "muted"}>{r.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{r.message}</p>
              <div className="mt-3 flex gap-2">
                {r.status !== "IN_PROGRESS" && <Button variant="outline" size="sm" onClick={() => setStatus.mutate({ id: r.id, status: "IN_PROGRESS" })}>Mark in progress</Button>}
                {r.status !== "CLOSED" && <Button variant="outline" size="sm" onClick={() => setStatus.mutate({ id: r.id, status: "CLOSED" })}>Close</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
