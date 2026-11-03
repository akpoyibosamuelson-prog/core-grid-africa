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
                Run your business.<br />Know your profit.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
                Core Grid Africa is one simple app that records your sales, tracks your stock and shows you
                exactly how much money you are making — built for Nigerian shops, wholesalers, distributors
                and entrepreneurs.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-white text-navy hover:bg-white/90">
                  <Link to="/register">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <a href="#how-it-works">See how it works</a>
                </Button>
                <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
              <p className="mt-5 text-sm text-white/55">
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

      {/* Plain-English explainer */}
      <Section className="pb-0">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">In plain English</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
                What does Core Grid Africa actually do for you?
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Think of it as your business's record book, calculator and adviser in one place. Every time you
                sell something, the app reduces your stock, records the money and works out your profit
                automatically. At the end of the day you can see what you sold, what you spent, who still owes
                you and how much you truly made &mdash; without a single spreadsheet.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { q: "I sell goods in a shop", a: "Record each sale in seconds and your stock count updates itself." },
                { q: "I buy from suppliers", a: "Log a purchase and your stock goes up; unpaid bills are tracked for you." },
                { q: "I give customers credit", a: "See exactly who owes you, how much, and how long it is overdue." },
                { q: "I want to grow", a: "Get a health score and clear, practical advice based on your own numbers." },
              ].map((r) => (
                <div key={r.q} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-navy">&ldquo;{r.q}&rdquo;</p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Modules */}
      <Section>
        <SectionHeading
          eyebrow="Everything in one platform"
          title="One system for your whole operation"
          subtitle="Stop juggling notebooks, spreadsheets and separate apps. Core Grid Africa connects every part of your business, so when you record a sale the stock, the money and the profit all update together \u2014 and the numbers always agree."
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
      <Section className="bg-card" id="how-it-works">
        <SectionHeading
          eyebrow="How it works"
          title="Up and running in three steps"
          subtitle="No consultants, no long training. Register your business today and start recording real transactions the same day \u2014 in plain English, on your phone or laptop."
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
              subtitle="Your records belong to your business only. Another company using Core Grid Africa can never see your customers, sales or money — and that is enforced on the server, not just hidden in the screen."
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

      {/* Two ways in */}
      <Section className="bg-card">
        <SectionHeading
          eyebrow="Getting in"
          title="Two doors, one platform"
          subtitle="Businesses sign in to their own workspace. The platform owner signs in to the control panel that runs Core Grid Africa itself."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary">
              <Store className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-navy">For business owners &amp; staff</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sign in to record sales, manage stock, track expenses and see your profit. New here? Create a free
              account and register your business in a couple of minutes.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild><Link to="/login">Business sign in</Link></Button>
              <Button asChild variant="outline"><Link to="/register">Create free account</Link></Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-navy">For the platform owner</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The Core Grid Africa control panel manages every registered business, user, subscription and
              payment on the platform. It is restricted to the platform owner account and checked on the server
              on every request.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link to="/login">Owner sign in</Link></Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Signing in with the owner account takes you straight to the control panel.
            </p>
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
              Start on the free plan and see your real numbers in minutes. Upgrade only when your business grows.
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
