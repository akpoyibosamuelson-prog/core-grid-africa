import { useState, type FormEvent } from "react";
import { Mail, Phone, MapPin, MessageSquare, CheckCircle2 } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Section, PageHero } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/_core/trpc";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = trpc.support.submit.useMutation({
    onSuccess: () => setSent(true),
    onError: (e) => setError(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    submit.mutate(form);
  }

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Contact"
        title="Talk to us"
        subtitle="Questions about the platform, pricing or onboarding? Send us a message and we'll get back to you."
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="space-y-4">
            {[
              { icon: <Mail className="h-5 w-5" />, t: "Email", d: "hello@coregridafrica.com" },
              { icon: <Phone className="h-5 w-5" />, t: "Phone", d: "+234 (0) 800 000 0000" },
              { icon: <MapPin className="h-5 w-5" />, t: "Office", d: "Lagos, Nigeria" },
              { icon: <MessageSquare className="h-5 w-5" />, t: "Support", d: "In-app support for all plans" },
            ].map((c) => (
              <div key={c.t} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">{c.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-navy">{c.t}</p>
                  <p className="text-sm text-muted-foreground">{c.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
              {sent ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <CheckCircle2 className="h-12 w-12 text-success" />
                  <h3 className="mt-4 text-lg font-semibold text-navy">Message received</h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Thank you for reaching out. Our team will respond to you shortly.
                  </p>
                  <Button className="mt-6" variant="outline" onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Your name</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={submit.isPending}>
                    {submit.isPending ? "Sending…" : "Send message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
