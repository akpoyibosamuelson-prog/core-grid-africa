import { Link } from "wouter";
import { Store, Warehouse, Truck, Pill, UtensilsCrossed, Briefcase, ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Section, SectionHeading, PageHero } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";

const SOLUTIONS = [
  {
    icon: <Store className="h-6 w-6" />,
    title: "Retail shops & supermarkets",
    body: "Fast point-of-sale, barcode-ready products and live stock so you never sell what you don't have.",
    points: ["Quick multi-item checkout", "Automatic stock deduction", "Low-stock alerts", "Daily sales reports"],
  },
  {
    icon: <Warehouse className="h-6 w-6" />,
    title: "Wholesalers & distributors",
    body: "Manage bulk pricing, supplier balances and customer credit across multiple branches.",
    points: ["Wholesale & retail price tiers", "Supplier purchase orders", "Customer outstanding balances", "Multi-branch stock transfers"],
  },
  {
    icon: <Truck className="h-6 w-6" />,
    title: "Logistics & delivery",
    body: "Track orders from confirmation to delivery with courier details and status updates.",
    points: ["Order status tracking", "Delivery assignment", "Payment status per order", "Customer notifications"],
  },
  {
    icon: <Pill className="h-6 w-6" />,
    title: "Pharmacies & health stores",
    body: "Keep tight control of stock levels and expiry-sensitive inventory with full movement history.",
    points: ["Batch & location tracking", "Stock adjustment audit", "Supplier management", "Valuation reports"],
  },
  {
    icon: <UtensilsCrossed className="h-6 w-6" />,
    title: "Restaurants & food businesses",
    body: "Record every sale, track ingredient costs and see your true profit after expenses.",
    points: ["Fast POS for busy hours", "Expense tracking", "Cost of goods sold", "Net profit reporting"],
  },
  {
    icon: <Briefcase className="h-6 w-6" />,
    title: "Service businesses & agencies",
    body: "Invoice clients, track payments and manage staff — without the spreadsheet chaos.",
    points: ["Invoices & receipts", "Payment tracking", "Staff roles & permissions", "Financial reports"],
  },
];

export default function Solutions() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Solutions"
        title="Built for the way your business actually works"
        subtitle="Whatever you sell and however you sell it, Core Grid Africa adapts to your operation — not the other way round."
      />

      <Section>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <div key={s.title} className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-primary">{s.icon}</span>
              <h3 className="mt-4 text-lg font-semibold text-navy">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              <ul className="mt-4 space-y-2">
                {s.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-card pb-24">
        <SectionHeading
          eyebrow="Not sure where you fit?"
          title="Start free and grow into it"
          subtitle="Every plan includes the core modules. Upgrade when your team or branch count grows."
        />
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/register">Create free account <ArrowRight className="h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/pricing">Compare plans</Link></Button>
        </div>
      </Section>
    </PublicLayout>
  );
}
