import { Bell, CheckCheck, Package, ShoppingCart, Users, CreditCard, AlertTriangle } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, ErrorState } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@shared/format";
import { cn } from "@/lib/utils";

function iconFor(type: string) {
  if (type === "SALE") return <ShoppingCart className="h-4 w-4" />;
  if (type === "ORDER") return <Package className="h-4 w-4" />;
  if (type === "CUSTOMER") return <Users className="h-4 w-4" />;
  if (type === "PAYMENT" || type === "PAYMENT_FAILED") return <CreditCard className="h-4 w-4" />;
  if (type === "LOW_STOCK" || type === "OUT_OF_STOCK") return <AlertTriangle className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}

export default function Notifications() {
  const { active } = useBusiness();
  const { push } = useToast();
  const bizId = active?.businessId ?? "";
  const list = trpc.notification.list.useQuery({ businessId: bizId }, { enabled: !!active });
  const utils = trpc.useUtils();
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: () => { void utils.notification.list.invalidate(); void utils.notification.unreadCount.invalidate(); } });
  const markAll = trpc.notification.markAllRead.useMutation({ onSuccess: () => { push({ kind: "success", title: "All marked as read" }); void utils.notification.list.invalidate(); void utils.notification.unreadCount.invalidate(); } });

  if (!active) return null;
  const rows = list.data ?? [];
  const unread = rows.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Alerts about sales, stock, orders and payments"
        help="Automatic warnings: stock running low, products finished, customers overdue, payments received or failed. Clear them once you have dealt with them."
        actions={unread > 0 && <Button variant="outline" onClick={() => markAll.mutate({ businessId: bizId })} disabled={markAll.isPending}><CheckCheck className="h-4 w-4" /> Mark all read</Button>}
      />

      {list.isLoading ? <LoadingState /> : list.isError ? <ErrorState message={list.error.message} onRetry={() => list.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="You'll see alerts here when sales, stock or payments need your attention." />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <div key={n.id} className={cn("flex items-start gap-3 rounded-xl border p-4 transition-colors", n.isRead ? "border-border bg-card" : "border-primary/30 bg-accent")}>
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", n.isRead ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
                {iconFor(n.type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-navy">{n.title}</p>
                  {!n.isRead && <Badge variant="primary">New</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </div>
              {!n.isRead && <Button variant="ghost" size="sm" onClick={() => markRead.mutate({ businessId: bizId, id: n.id })}>Mark read</Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
