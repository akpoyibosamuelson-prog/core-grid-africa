import { useState } from "react";
import { Link } from "wouter";
import { Check, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Section, SectionHeading, PageHero } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS } from "@shared/constants";
import { formatMoney } from "@shared/format";
import { cn } from "@/lib/utils";

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Pricing"
        title="Simple pricing that grows with you"
        subtitle="Start free, forever. Upgrade when your team, branches or product catalogue grow. No hidden fees."
      />

      <Section>
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn("rounded-md px-4 py-2 text-sm font-medium transition-colors", !annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn("rounded-md px-4 py-2 text-sm font-medium transition-colors", annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
            >
              Annual <span className="text-success">· save 2 months</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {PLANS.map((p) => {
            const price = annual ? p.annual : p.monthly;
            const featured = p.tier === "BUSINESS";
            return (
              <div
                key={p.tier}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
                  featured ? "border-primary ring-2 ring-primary/20" : "border-border",
                )}
              >
                {featured && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>
                )}
                <h3 className="text-lg font-semibold text-navy">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                <div className="mt-5">
                  <span className="text-3xl font-bold text-navy">{price === 0 ? "Free" : formatMoney(price)}</span>
                  {price !== 0 && <span className="text-sm text-muted-foreground">/{annual ? "year" : "month"}</span>}
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6" variant={featured ? "default" : "outline"}>
                  <Link to="/register">{p.tier === "FREE" ? "Start free" : `Choose ${p.name}`}</Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Prices in Nigerian Naira. Subscription payments are processed securely — you can change or cancel your plan at any time.
        </p>
      </Section>

      <Section className="bg-card pb-24">
        <SectionHeading eyebrow="Questions" title="Frequently asked" />
        <div className="mx-auto mt-10 max-w-3xl space-y-4">
          {[
            { q: "Is the free plan really free?", a: "Yes. The Free plan has no time limit and no card required. It covers one branch, up to 50 products and one user — enough to run a small shop properly." },
            { q: "Can I change plans later?", a: "Absolutely. Upgrade or downgrade at any time from your business settings. Your data is never lost when you change plans." },
            { q: "Do you support multiple branches?", a: "Yes. Starter supports 2 branches, Business supports 5, and Enterprise is unlimited — each with its own inventory, sales and expenses." },
            { q: "How do I pay?", a: "Subscription payments are handled through our secure payment integration. You'll be able to pay by card or transfer directly from your dashboard." },
          ].map((f) => (
            <div key={f.q} className="rounded-xl border border-border bg-background p-5">
              <h3 className="font-semibold text-navy">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button asChild size="lg"><Link to="/register">Get started free <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </Section>
    </PublicLayout>
  );
}
