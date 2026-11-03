import { Link } from "wouter";
import {
  ArrowRight, BarChart3, Boxes, CreditCard, FileText, LayoutDashboard, Package,
  Receipt, ShieldCheck, ShoppingCart, Store, Truck, Users, Wallet, Zap, CheckCircle2,
} from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Section, SectionHeading, FeatureCard, Stat } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MODULES = [
  { icon: <ShoppingCart className="h-5 w-5" />, title: "Sales & POS", body: "Ring up multi-product sales with discounts, taxes and every payment method — cash, transfer, POS or online." },
  { icon: <Boxes className="h-5 w-5" />, title: "Inventory", body: "Track stock in real time. Sales and purchases update quantities automatically, with low-stock alerts before you run out." },
  { icon: <Package className="h-5 w-5" />, title: "Purchases & Suppliers", body: "Raise purchase orders, receive stock and keep supplier balances in one place." },
  { icon: <Wallet className="h-5 w-5" />, title: "Expenses", body: "Record rent, salaries, logistics and more — with receipts, categories and recurring entries." },
  { icon: <BarChart3 className="h-5 w-5" />, title: "Finance & Reports", body: "Revenue, cost of goods, gross and net profit, cash flow and receivables — computed from your real data." },
  { icon: <Users className="h-5 w-5" />, title: "Customers & CRM", body: "Know your best customers, their purchase history and who still owes you money." },
  { icon: <Truck className="h-5 w-5" />, title: "Orders & Delivery", body: "Track every order from pending to delivered, with payment status and delivery details." },
  { icon: <Store className="h-5 w-5" />, title: "Multi-branch", body: "Run several locations, transfer stock between them and see consolidated performance." },
  { icon: <CreditCard className="h-5 w-5" />, title: "Payments", body: "Accept online payments with secure server-side verification — never trust the browser alone." },
];

const STEPS = [
  { n: "01", title: "Create your account", body: "Sign up in seconds and register your business with your own currency, tax and invoice settings." },
  { n: "02", title: "Add your products & staff", body: "Import your catalogue, set prices and stock levels, then invite your team with the right permissions." },
  { n: "03", title: "Sell, track and grow", body: "Record sales, watch inventory and profit update live, and make decisions from real numbers." },
];

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero */}
      <div className="cga-gradient relative overflow-hidden">
        <div className="cga-grid-pattern absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                <Zap className="mr-1.5 h-3 w-3" /> Digital Infrastructure for Growing Businesses
              </Badge>
              <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Run your entire business from one place.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
                Core Grid Africa brings sales, inventory, purchases, expenses, finance, customers and staff
                together — built for Nigerian retailers, wholesalers, distributors and entrepreneurs.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-white text-navy hover:bg-white/90">
                  <Link to="/register">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <Link to="/features">See all features</Link>
                </Button>
              </div>
              <p className="mt-5 text-sm text-white/50">
                No card required · Free plan forever · Set up in minutes
              </p>
            </div>

            {/* Product preview card */}
            <div className="relative">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-2 shadow-2xl backdrop-blur">
                <div className="rounded-xl bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-navy">Business Overview</span>
                    </div>
                    <Badge variant="success">Live</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { label: "Today's sales", value: "₦184,500", tone: "text-navy" },
                      { label: "Gross profit", value: "₦62,300", tone: "text-success" },
                      { label: "Low stock items", value: "4", tone: "text-warning" },
                      { label: "Outstanding", value: "₦27,000", tone: "text-destructive" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-border bg-muted/40 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                        <p className={`mt-1 text-lg font-bold ${s.tone}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      { name: "Rice 50kg bag", qty: "12 sold", amt: "₦96,000" },
                      { name: "Cooking oil 5L", qty: "8 sold", amt: "₦44,000" },
                      { name: "Detergent carton", qty: "5 sold", amt: "₦32,500" },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-navy">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.qty}</p>
                        </div>
                        <p className="text-sm font-semibold text-navy">{r.amt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          <Stat value="14+" label="Integrated modules" />
          <Stat value="₦" label="Naira-first, multi-currency ready" />
          <Stat value="100%" label="Real database, no mock data" />
          <Stat value="7" label="Role-based permission levels" />
        </div>
      </div>

      {/* Modules */}
      <Section>
        <SectionHeading
          eyebrow="Everything in one platform"
          title="One system for your whole operation"
          subtitle="Stop juggling notebooks, spreadsheets and separate apps. Core Grid Africa connects every part of your business so the numbers always agree."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <FeatureCard key={m.title} icon={m.icon} title={m.title}>
              {m.body}
            </FeatureCard>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section className="bg-card">
        <SectionHeading
          eyebrow="How it works"
          title="Up and running in three steps"
          subtitle="No consultants, no long onboarding. Register your business and start recording real transactions the same day."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-xl border border-border bg-background p-6">
              <span className="text-3xl font-bold text-primary/20">{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold text-navy">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Trust / security */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Built to be trusted"
              title="Your business data stays yours"
              subtitle="Every record is scoped to your business. One business can never see another's data — enforced on the server, not just hidden in the interface."
            />
            <ul className="mt-8 space-y-4">
              {[
                { icon: <ShieldCheck className="h-5 w-5" />, t: "Business-level data isolation", d: "Every query is filtered by your business on the server." },
                { icon: <Users className="h-5 w-5" />, t: "Role-based permissions", d: "Owners control exactly what each staff member can view, create, edit or delete." },
                { icon: <Receipt className="h-5 w-5" />, t: "Audit trail", d: "Important actions are logged so you always know what happened and who did it." },
                { icon: <FileText className="h-5 w-5" />, t: "Invoices & receipts", d: "Generate, print and download professional documents for every sale." },
              ].map((f) => (
                <li key={f.t} className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    {f.icon}
                  </span>
                  <div>
                    <p className="font-medium text-navy">{f.t}</p>
                    <p className="text-sm text-muted-foreground">{f.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h3 className="text-lg font-semibold text-navy">Who it's for</h3>
            <div className="mt-5 space-y-3">
              {["Retail shops & supermarkets", "Wholesalers & distributors", "Pharmacies & provision stores", "Restaurants & food businesses", "Service businesses & agencies", "Entrepreneurs scaling up"].map((w) => (
                <div key={w} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  <span className="text-sm font-medium text-navy">{w}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section className="pb-24">
        <div className="cga-gradient relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12">
          <div className="cga-grid-pattern absolute inset-0 opacity-30" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to power your business?
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Join the businesses building on Core Grid Africa. Start on the free plan — upgrade only when you grow.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-white text-navy hover:bg-white/90">
                <Link to="/register">
                  Create your free account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
