import { useEffect } from "react";
import { useLocation } from "wouter";

// Legacy template route — the real dashboard lives at /app (Overview).
// Kept so any old link still lands somewhere sensible.
export default function Dashboard() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/app");
  }, [navigate]);
  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
      Redirecting to your dashboard…
    </main>
  );
}
