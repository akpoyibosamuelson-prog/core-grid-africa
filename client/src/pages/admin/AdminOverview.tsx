import { Building2, Users, CreditCard, TrendingUp, LifeBuoy } from "lucide-react";
import { PageHeader, StatCard, LoadingState, ErrorState } from "@/components/app/shared";
import { trpc } from "@/_core/trpc";
import { formatMoney } from "@shared/format";

export default function AdminOverview() {
  const q = trpc.admin.stats.useQuery();
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const s = q.data!;
  return (
    <div className="space-y-6">
      <PageHeader title="Platform Overview" description="Core Grid Africa at a glance" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Businesses" value={String(s.businesses)} hint={`${s.activeBusinesses} active`} icon={<Building2 className="h-4 w-4" />} tone="primary" />
        <StatCard label="Users" value={String(s.users)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Active subscriptions" value={String(s.activeSubscriptions)} icon={<CreditCard className="h-4 w-4" />} tone="success" />
        <StatCard label="Platform revenue" value={formatMoney(s.platformRevenue, "₦")} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Suspended businesses" value={String(s.suspendedBusinesses)} tone="danger" />
        <StatCard label="Open support requests" value={String(s.openSupport)} tone="warning" icon={<LifeBuoy className="h-4 w-4" />} />
      </div>
    </div>
  );
}
