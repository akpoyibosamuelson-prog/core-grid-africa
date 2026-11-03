import { Link } from "wouter";
import {
  ShoppingCart, Boxes, Package, Wallet, BarChart3, Users, Truck, Store, CreditCard,
  Bell, ShieldCheck, FileText, ArrowRight, LayoutDashboard, Building2, Settings,
} from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Section, SectionHeading, PageHero, FeatureCard } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";

const GROUPS = [
  {
    title: "Operations",
    items: [
      { icon: <LayoutDashboard className="h-5 w-5" />, t: "Business dashboard", d: "Live overview of sales, profit, stock and outstanding payments with date filters." },
      { icon: <ShoppingCart className="h-5 w-5" />, t: "Sales & POS", d: "Multi-product sales, discounts, taxes, partial payments and instant receipts." },
      { icon: <Boxes className="h-5 w-5" />, t: "Inventory management", d: "Products, categories, SKUs, barcodes, stock adjustments and full movement history." },
      { icon: <Package className="h-5 w-5" />, t: "Purchases & suppliers", d: "Purchase orders, supplier registry, payments and outstanding balances." },
    ],
  },
  {
    title: "Money",
    items: [
      { icon: <Wallet className="h-5 w-5" />, t: "Expense management", d: "Categorised expenses with receipts, recurring entries and export." },
      { icon: <BarChart3 className="h-5 w-5" />, t: "Financial management", d: "Revenue, cost of goods, gross and net profit, cash flow, receivables and payables." },
      { icon: <FileText className="h-5 w-5" />, t: "Reports & analytics", d: "Daily to annual reports with charts, PDF download and CSV export." },
      { icon: <CreditCard className="h-5 w-5" />, t: "Online payments", d: "Secure payment processing with independent server-side verification." },
    ],
  },
  {
    title: "People & growth",
    items: [
      { icon: <Users className="h-5 w-5" />, t: "Customer CRM", d: "Profiles, purchase history, outstanding balances and your most valuable customers." },
      { icon: <Truck className="h-5 w-5" />, t: "Orders & delivery", d: "Order lifecycle from pending to delivered, with payment and delivery tracking." },
      { icon: <Building2 className="h-5 w-5" />, t: "Employees & roles", d: "Staff profiles with seven permission levels controlled by the owner." },
      { icon: <Store className="h-5 w-5" />, t: "Multi-branch", d: "Branch-specific inventory, sales and expenses with consolidated reporting." },
    ],
  },
  {
    title: "Platform",
    items: [
      { icon: <Bell className="h-5 w-5" />, t: "Notifications", d: "Alerts for new sales, low stock, outstanding payments and important activity." },
      { icon: <ShieldCheck className="h-5 w-5" />, t: "Security & audit", d: "Hashed passwords, protected routes, data isolation and an audit trail." },
      { icon: <Settings className="h-5 w-5" />, t: "Business settings", d: "Currency, tax, invoice numbering, receipt footer and notification preferences." },
      { icon: <BarChart3 className="h-5 w-5" />, t: "Business insights", d: "Computed insights from your real data — best sellers, trends and warnings." },
    ],
  },
];

export default function Features() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Features"
        title="Every tool your business needs, connected"
        subtitle="Fourteen integrated modules that share one database — so a sale updates your stock, your profit and your customer's history at the same time."
      />

      {GROUPS.map((g, i) => (
        <Section key={g.title} className={i % 2 === 1 ? "bg-card" : ""}>
          <SectionHeading align="left" eyebrow={`0${i + 1}`} title={g.title} />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {g.items.map((it) => (
              <FeatureCard key={it.t} icon={it.icon} title={it.t}>{it.d}</FeatureCard>
            ))}
          </div>
        </Section>
      ))}

      <Section className="pb-24">
        <div className="cga-gradient relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12">
          <div className="cga-grid-pattern absolute inset-0 opacity-30" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">See it with your own data</h2>
            <p className="mt-4 text-lg text-white/70">Create a free account and start recording real transactions today.</p>
            <Button asChild size="lg" className="mt-8 bg-white text-navy hover:bg-white/90">
              <Link to="/register">Start free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
