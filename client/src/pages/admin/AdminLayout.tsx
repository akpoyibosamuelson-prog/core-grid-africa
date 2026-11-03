import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Building2, Users, CreditCard, Receipt, LifeBuoy, ScrollText, Settings, ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import AdminGuard from "@/components/admin/AdminGuard";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/payments", label: "Payments", icon: Receipt },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <AdminGuard>
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-navy text-white/80">
          <div className="flex h-16 items-center gap-2 px-4">
            <Logo variant="light" />
          </div>
          <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-white/70">
            <ShieldCheck className="h-3.5 w-3.5" /> Super Admin
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = location === n.href || (n.href !== "/admin" && location.startsWith(n.href));
              return (
                <Link key={n.href} to={n.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-primary text-white" : "text-white/70 hover:bg-white/10 hover:text-white")}>
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-3">
            <Link to="/app" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to business app
            </Link>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6 lg:hidden">
          <Logo />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
    </AdminGuard>
  );
}
