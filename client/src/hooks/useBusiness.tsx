import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import type { MemberRole } from "@shared/constants";
import { roleCanAccess } from "@shared/constants";

const STORAGE_KEY = "cga_active_business";

export interface BusinessSummary {
  businessId: string;
  role: MemberRole;
  status: string;
  businessName: string;
  businessSlug: string;
  plan: string;
  currency: string;
  currencySymbol: string;
  logoUrl: string | null;
}

interface BusinessContextValue {
  memberships: BusinessSummary[];
  active: BusinessSummary | null;
  activeId: string | null;
  setActiveId: (id: string) => void;
  isLoading: boolean;
  can: (moduleKey: string) => boolean;
  isOwnerOrAdmin: boolean;
  refetch: () => void;
}

const Ctx = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeId, setActiveIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const query = trpc.business.listMine.useQuery(undefined, { enabled: !!user });

  const memberships = (query.data ?? []) as BusinessSummary[];

  // Keep the active business valid: if the stored one is gone, fall back to the first.
  useEffect(() => {
    if (memberships.length === 0) return;
    const exists = memberships.some((m) => m.businessId === activeId);
    if (!exists) {
      const first = memberships[0].businessId;
      setActiveIdState(first);
      localStorage.setItem(STORAGE_KEY, first);
    }
  }, [memberships, activeId]);

  const setActiveId = (id: string) => {
    setActiveIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const active = useMemo(
    () => memberships.find((m) => m.businessId === activeId) ?? memberships[0] ?? null,
    [memberships, activeId],
  );

  const value: BusinessContextValue = {
    memberships,
    active,
    activeId: active?.businessId ?? null,
    setActiveId,
    isLoading: query.isLoading,
    can: (moduleKey: string) => (active ? roleCanAccess(active.role, moduleKey) : false),
    isOwnerOrAdmin: active ? active.role === "OWNER" || active.role === "ADMIN" : false,
    refetch: () => query.refetch(),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBusiness() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBusiness must be used within <BusinessProvider>");
  return ctx;
}

/** Convenience: the active business id, throwing if there is none. */
export function useActiveBusinessId(): string {
  const { activeId } = useBusiness();
  if (!activeId) throw new Error("No active business");
  return activeId;
}
