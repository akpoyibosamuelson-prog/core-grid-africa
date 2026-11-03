import { Link } from "wouter";
import { Target, Eye, Heart, Users, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Section, SectionHeading, PageHero, Stat } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";

export default function About() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="About us"
        title="Digital infrastructure for growing businesses"
        subtitle="Core Grid Africa exists to give every Nigerian business — from the corner shop to the multi-branch distributor — the same operational power that large companies take for granted."
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Our story"
              title="Built for the businesses that build Africa"
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Most small and medium businesses in Nigeria still run on paper, memory and disconnected
                spreadsheets. Stock counts don't match, profit is a guess, and money owed is forgotten.
              </p>
              <p>
                Core Grid Africa was built to change that. We bring sales, inventory, purchases, expenses,
                finance, customers, orders and staff into one connected system — so every number is real,
                every record is traceable, and every decision can be made with confidence.
              </p>
              <p>
                We start with Nigeria, where the need is greatest and the opportunity is enormous, and we
                build for the rest of Africa from day one.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: <Target className="h-5 w-5" />, t: "Our mission", d: "To give every growing business the operational tools to run profitably and scale with confidence." },
              { icon: <Eye className="h-5 w-5" />, t: "Our vision", d: "A continent where no business is held back by poor record-keeping or fragmented tools." },
              { icon: <Heart className="h-5 w-5" />, t: "Our values", d: "Clarity over complexity. Real data over guesswork. Reliability above all." },
              { icon: <ShieldCheck className="h-5 w-5" />, t: "Our promise", d: "Your data is yours. Isolated, secure and never shared across businesses." },
            ].map((c) => (
              <div key={c.t} className="rounded-xl border border-border bg-card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">{c.icon}</span>
                <h3 className="mt-3 font-semibold text-navy">{c.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-card">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          <Stat value="14+" label="Modules in one platform" />
          <Stat value="7" label="Staff permission levels" />
          <Stat value="₦" label="Naira-first by default" />
          <Stat value="24/7" label="Always-on cloud access" />
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="What drives us"
          title="Principles we build by"
          subtitle="These aren't slogans — they're the rules that shape every feature we ship."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { icon: <TrendingUp className="h-5 w-5" />, t: "Real numbers only", d: "Every figure in the platform comes from your actual records. No placeholders, no fake data." },
            { icon: <Users className="h-5 w-5" />, t: "Built for teams", d: "Owners, managers, sales staff, accountants — each sees exactly what they should." },
            { icon: <ShieldCheck className="h-5 w-5" />, t: "Security by default", d: "Server-side authentication, isolated data and a full audit trail on important actions." },
          ].map((c) => (
            <div key={c.t} className="rounded-xl border border-border bg-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary">{c.icon}</span>
              <h3 className="mt-4 font-semibold text-navy">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="pb-24">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h2 className="text-2xl font-bold text-navy sm:text-3xl">Join us on the journey</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Whether you run one shop or twenty, Core Grid Africa grows with you.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/register">Get started free <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </Section>
    </PublicLayout>
  );
}
