import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { KeyRound, ShieldCheck, Check } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

/**
 * Account settings — currently the password change, which is also how a
 * platform administrator clears the "must change password" flag set when their
 * account was bootstrapped with an administrator-chosen password.
 */
export default function Account() {
  const { user } = useAuth();
  const { push } = useToast();
  const utils = trpc.useUtils();
  const me = trpc.platform.me.useQuery(undefined, { enabled: !!user, retry: false });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const change = trpc.auth.changePassword.useMutation({
    onSuccess: async () => {
      push({ kind: "success", title: "Password changed", message: "Use your new password next time you sign in." });
      setCurrent(""); setNext(""); setConfirm(""); setError(null);
      await utils.platform.me.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("Your new password must be at least 8 characters.");
    if (next !== confirm) return setError("The two new passwords do not match.");
    change.mutate({ currentPassword: current, newPassword: next });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/"><Logo /></Link>
          <Link to="/app" className="text-sm font-medium text-primary hover:underline">Back to dashboard</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 py-8 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Account settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your sign-in credentials.</p>
        </div>

        {me.data?.mustChangePassword && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-navy">Change your password</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                This account was set up with an administrator-issued password. Choose your own now to secure it.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Change password</CardTitle>
            <CardDescription>Signed in as {user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">New password</Label>
                <Input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {change.isSuccess && (
                <p className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" /> Password updated.</p>
              )}
              <Button type="submit" disabled={change.isPending}>
                {change.isPending ? "Saving…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
