import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PERKS = [
  "Free plan, no card required",
  "Sales, inventory & expenses in one place",
  "Real reports from your real data",
];

export default function Signup() {
  const { signup, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup(email, password, name || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  if (user) return <Redirect to="/app" />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="cga-gradient relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="cga-grid-pattern absolute inset-0 opacity-40" />
        <div className="relative">
          <Link to="/"><Logo variant="light" /></Link>
        </div>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight text-white">
            Everything your business needs, in one place.
          </h2>
          <ul className="mt-6 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white/80">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#8FB0FF]" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs font-medium uppercase tracking-[0.14em] text-white/50">
          Powering Businesses. Connecting Growth.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Link to="/"><Logo /></Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>Start running your business on Core Grid Africa.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Okafor" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Log in
                </Link>
              </p>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="hover:text-foreground">Terms</Link> and{" "}
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
