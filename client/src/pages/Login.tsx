import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { useAuth } from "@/_core/useAuth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  // Platform administrators land in the super admin dashboard; everyone else
  // goes to their business dashboard.
  if (user) return <Redirect to={user.role === "admin" ? "/admin" : "/app"} />;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <Link to="/"><Logo /></Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>
                Sign in to your Core Grid Africa workspace. Business owners and staff land in the business app;
                the platform owner lands in the control panel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Logging in…" : "Log in"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                No account?{" "}
                <Link to="/register" className="font-medium text-primary hover:underline">
                  Create one free
                </Link>
              </p>
              <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-xs font-semibold text-navy">Platform owner?</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Sign in with the owner account above and you will be taken straight to the Core Grid Africa
                  control panel. Access is verified on the server, so a normal business account cannot open it.
                </p>
              </div>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to home</Link>
            <span className="mx-2">·</span>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
