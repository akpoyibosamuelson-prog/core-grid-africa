import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/components/ui/toast";

const INDUSTRIES = [
  "Retail & Supermarket", "Wholesale & Distribution", "Pharmacy & Health",
  "Restaurant & Food", "Fashion & Apparel", "Electronics", "Agriculture",
  "Logistics & Transport", "Services & Consulting", "Manufacturing", "Other",
];

const CURRENCIES = [
  { code: "NGN", symbol: "₦", label: "Nigerian Naira (₦)" },
  { code: "GHS", symbol: "₵", label: "Ghanaian Cedi (₵)" },
  { code: "KES", symbol: "KSh", label: "Kenyan Shilling (KSh)" },
  { code: "ZAR", symbol: "R", label: "South African Rand (R)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { refetch } = useBusiness();
  const { push } = useToast();
  const [form, setForm] = useState({
    name: "", industry: INDUSTRIES[0], phone: "", email: "", address: "",
    city: "", state: "", currency: "NGN", currencySymbol: "₦", taxRate: 750,
  });
  const [error, setError] = useState<string | null>(null);

  const create = trpc.business.create.useMutation({
    onSuccess: async () => {
      push({ kind: "success", title: "Business created", message: "Welcome to Core Grid Africa." });
      await refetch();
      navigate("/app");
    },
    onError: (e) => setError(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate(form);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary"><Building2 className="h-5 w-5" /></span>
              <div>
                <CardTitle>Register your business</CardTitle>
                <CardDescription>Tell us about your business so we can set up your workspace.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Business name *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ada Stores Ltd" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select id="industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234…" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Business email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hello@business.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Shop 12, Market Road" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select id="currency" value={form.currency} onChange={(e) => { const c = CURRENCIES.find((x) => x.code === e.target.value)!; setForm({ ...form, currency: c.code, currencySymbol: c.symbol }); }}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax">Default tax rate (%)</Label>
                  <Input id="tax" type="number" step="0.01" min="0" value={form.taxRate / 100} onChange={(e) => setForm({ ...form, taxRate: Math.round(Number(e.target.value) * 100) })} />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? "Creating…" : <>Create business <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
            <div className="mt-6 rounded-lg bg-muted/50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-navy"><CheckCircle2 className="h-4 w-4 text-success" /> What happens next</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• A Main Branch is created automatically</li>
                <li>• You become the Owner with full permissions</li>
                <li>• You start on the Free plan — upgrade any time</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
