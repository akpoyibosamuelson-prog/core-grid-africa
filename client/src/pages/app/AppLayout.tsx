import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, ShoppingCart, Monitor, Boxes, Package, Truck, Users, Factory,
  Wallet, BarChart3, UserCog, FileText, Bell, Settings, Building2, Menu, X,
  LogOut, ChevronDown, Search, ShieldCheck, Sparkles, HandCoins, LineChart,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/useAuth";
import { useBusiness } from "@/hooks/useBusiness";
import { trpc } from "@/_core/trpc";
import { cn } from "@/lib/utils";
import { initials } from "@shared/format";

const NAV = [
  { key: "overview", href: "/app", label: "Overview", icon: LayoutDashboard },
  { key: "sales", href: "/app/sales", label: "Sales", icon: ShoppingCart },
  { key: "pos", href: "/app/pos", label: "POS", icon: Monitor },
  { key: "inventory", href: "/app/inventory", label: "Inventory", icon: Boxes },
  { key: "purchases", href: "/app/purchases", label: "Purchases", icon: Package },
  { key: "orders", href: "/app/orders", label: "Orders", icon: Truck },
  { key: "customers", href: "/app/customers", label: "Customers", icon: Users },
  { key: "suppliers", href: "/app/suppliers", label: "Suppliers", icon: Factory },
  { key: "expenses", href: "/app/expenses", label: "Expenses", icon: Wallet },
  { key: "finance", href: "/app/finance", label: "Finance", icon: BarChart3 },
  { key: "employees", href: "/app/employees", label: "Employees", icon: UserCog },
  { key: "reports", href: "/app/reports", label: "Reports", icon: FileText },
  { key: "analytics", href: "/app/analytics", label: "Analytics", icon: LineChart },
  { key: "advisor", href: "/app/advisor", label: "AI Advisor", icon: Sparkles },
  { key: "debts", href: "/app/debts", label: "Debts", icon: HandCoins },
  { key: "notifications", href: "/app/notifications", label: "Notifications", icon: Bell },
  { key: "settings", href: "/app/settings", label: "Settings", icon: Settings },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const { user, logout } = useAuth();
  const { memberships, active, setActiveId, can, isLoading } = useBusiness();
  const unread = trpc.notification.unreadCount.useQuery(
    { businessId: active?.businessId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: !!active },
  );

  const visibleNav = NAV.filter((n) => can(n.key));

  const sidebar = (
    <div className="flex h-full flex-col bg-navy text-white/80">
      <div className="flex h-16 items-center justify-between px-4">
        <Link to="/app" onClick={() => setMobileOpen(false)}>
          <Logo variant="light" />
        </Link>
        <button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const activeItem = location === n.href || (n.href !== "/app" && location.startsWith(n.href));
          return (
            <Link
              key={n.key}
              to={n.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                activeItem ? "bg-primary text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{n.label}</span>
              {n.key === "notifications" && (unread.data ?? 0) > 0 && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">{unread.data}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-xs font-medium text-white/60">Current plan</p>
          <p className="mt-0.5 text-sm font-semibold text-white">{active?.plan ?? "FREE"}</p>
          <Link to="/app/settings" className="mt-2 inline-block text-xs font-medium text-[#8FB0FF] hover:underline">Manage subscription →</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-64">{sidebar}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden max-w-xs flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search products, sales, customers…"
              className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) window.location.href = `/app/inventory?q=${encodeURIComponent(v)}`;
                }
              }}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setBizOpen((v) => !v)} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="max-w-[120px] truncate font-medium">{active?.businessName ?? "Select business"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {bizOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBizOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-card p-1 shadow-lg">
                    {memberships.map((m) => (
                      <button
                        key={m.businessId}
                        onClick={() => { setActiveId(m.businessId); setBizOpen(false); }}
                        className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted", m.businessId === active?.businessId && "bg-accent")}
                      >
                        <span className="truncate font-medium">{m.businessName}</span>
                        <Badge variant="muted" className="ml-2 shrink-0">{m.role}</Badge>
                      </button>
                    ))}
                    <Link to="/app/onboarding" onClick={() => setBizOpen(false)} className="mt-1 block rounded-md border-t border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted">
                      + Add another business
                    </Link>
                  </div>
                </>
              )}
            </div>

            <Link to="/app/notifications" className="relative rounded-md p-2 hover:bg-muted" aria-label="Notifications">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {(unread.data ?? 0) > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">{unread.data}</span>
              )}
            </Link>

            <div className="relative">
              <button onClick={() => setUserOpen((v) => !v)} className="flex items-center gap-2 rounded-md p-1 hover:bg-muted">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {initials(user?.name ?? user?.email)}
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
              </button>
              {userOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium">{user?.name ?? "Account"}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    <Link to="/app/settings" onClick={() => setUserOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    {user?.role === "admin" && (
                      <Link to="/admin" onClick={() => setUserOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted">
                        <ShieldCheck className="h-4 w-4" /> Super admin
                      </Link>
                    )}
                    <button onClick={() => { setUserOpen(false); void logout(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted">
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">Loading your business…</div>
          ) : !active ? (
            <div className="mx-auto max-w-md py-16 text-center">
              <LogoMark className="mx-auto h-12 w-12" />
              <h2 className="mt-4 text-xl font-bold text-navy">No business yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Create your business to start using Core Grid Africa.</p>
              <Button asChild className="mt-6"><Link to="/app/onboarding">Create a business</Link></Button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
