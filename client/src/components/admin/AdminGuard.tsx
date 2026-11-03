import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { ShieldAlert } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { Button } from "@/components/ui/button";

/**
 * Client-side gate for the super admin area.
 *
 * This is PRESENTATION only — it keeps a non-admin from seeing an admin shell
 * they cannot use. The real protection is server-side: every /admin procedure
 * runs through `platformAdminProcedure`, which re-reads the role from the
 * database. A user who bypasses this component still gets FORBIDDEN from the
 * API, so nothing is exposed by hiding or not hiding a menu item.
 */
export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const me = trpc.platform.me.useQuery(undefined, { enabled: !!user, retry: false });

  if (authLoading || (user && me.isLoading)) {
    return <div className="p-8 text-muted-foreground">Checking access…</div>;
  }
  if (!user) return <Redirect to="/login" />;

  if (me.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <div>
          <p className="text-lg font-semibold text-navy">Platform administrator access required</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This area is for Core Grid Africa platform staff. Your account does not have access.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/app">Go to your business dashboard</a>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
