import { useState } from "react";
import {
  Sparkles, Send, Loader2, Lightbulb, TrendingUp, ShieldCheck, Info,
  Target, AlertTriangle, CheckCircle2, History, Bot,
} from "lucide-react";
import { PageHeader, StatCard, LoadingState, ErrorState, EmptyState } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { trpc } from "@/_core/trpc";
import { useBusiness } from "@/hooks/useBusiness";
import { formatMoney, relativeTime } from "@shared/format";

const SUGGESTIONS = [
  "How can I increase my revenue this month?",
  "Where can I cut expenses without hurting sales?",
  "How do I improve my profit margin?",
  "Which products should I restock first?",
  "How do I get more repeat customers?",
  "Is my business healthy enough to expand?",
];

function scoreTone(score: number): { ring: string; text: string; label: string } {
  if (score >= 85) return { ring: "text-success", text: "text-success", label: "Excellent" };
  if (score >= 70) return { ring: "text-primary", text: "text-primary", label: "Good" };
  if (score >= 55) return { ring: "text-warning", text: "text-warning", label: "Fair" };
  return { ring: "text-destructive", text: "text-destructive", label: "Needs attention" };
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const tone = scoreTone(score);
  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-36 w-36 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" className={tone.ring} stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold ${tone.text}`}>{score}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "muted"> = {
  HIGH: "destructive",
  MEDIUM: "warning",
  LOW: "muted",
};

export default function Advisor() {
  const { active } = useBusiness();
  const sym = active?.currencySymbol ?? "₦";
  const [tab, setTab] = useState("health");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; topicLabel: string; source: string } | null>(null);

  const bizId = active?.businessId ?? "";
  const status = trpc.advisor.status.useQuery();
  const health = trpc.advisor.health.useQuery({ businessId: bizId }, { enabled: !!active });
  const recs = trpc.advisor.recommendations.useQuery({ businessId: bizId }, { enabled: !!active && tab === "advice" });
  const history = trpc.advisor.history.useQuery({ businessId: bizId }, { enabled: !!active && tab === "history" });

  const ask = trpc.advisor.ask.useMutation({
    onSuccess: (res) => {
      setAnswer({ answer: res.answer, topicLabel: res.topicLabel, source: res.source });
      void history.refetch();
    },
  });

  if (!active) return null;

  function submit(q?: string) {
    const text = (q ?? question).trim();
    if (text.length < 3) return;
    setQuestion(text);
    setAnswer(null);
    ask.mutate({ businessId: bizId, question: text });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Business Advisor"
        description="Grounded in your own records — every figure comes from your data."
        help="This page reads your sales, expenses, stock and debts, then tells you what is healthy and what to fix first. Nothing here is generic advice — it is calculated from your own numbers."
        actions={
          <Badge variant={status.data?.configured ? "success" : "muted"} className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            {status.data?.configured ? `AI: ${status.data.model}` : "Rules engine"}
          </Badge>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "health", label: "Business health" },
          { key: "advice", label: "Recommendations" },
          { key: "ask", label: "Ask a question" },
          { key: "history", label: "History" },
        ]}
      />

      {tab === "health" && (
        <>
          {health.isLoading ? <LoadingState label="Scoring your business…" /> : health.isError ? <ErrorState message={health.error.message} onRetry={() => health.refetch()} /> : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6">
                  <ScoreRing score={health.data!.overall} />
                  <p className="mt-3 text-lg font-bold text-navy">{health.data!.grade}</p>
                  <p className="text-xs text-muted-foreground">Overall business health</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
                  <h3 className="flex items-center gap-2 font-semibold text-navy"><Target className="h-4 w-4 text-primary" /> What this score means</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Six weighted dimensions, scored from your real numbers for this month. Each one shows what it measured and what to do about it.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {health.data!.dimensions.map((dim) => (
                      <div key={dim.key} className="rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-navy">{dim.label}</span>
                          <span className={`text-sm font-bold ${scoreTone(dim.score).text}`}>{dim.score}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${dim.score >= 70 ? "bg-success" : dim.score >= 55 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${dim.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {health.data!.dimensions.map((dim) => (
                  <div key={dim.key} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-navy">{dim.label}</h3>
                      <Badge variant={dim.score >= 70 ? "success" : dim.score >= 55 ? "warning" : "destructive"}>{dim.score}/100</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{dim.explanation}</p>
                    <div className="mt-3 space-y-1.5">
                      {dim.opportunities.map((o, i) => (
                        <p key={i} className="flex items-start gap-2 text-xs text-muted-foreground"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />{o}</p>
                      ))}
                    </div>
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Do this</p>
                      {dim.actions.map((a, i) => (
                        <p key={i} className="mt-1 flex items-start gap-2 text-xs text-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />{a}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "advice" && (
        <>
          {recs.isLoading ? <LoadingState label="Finding what to fix first…" /> : recs.isError ? <ErrorState message={recs.error.message} onRetry={() => recs.refetch()} /> : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Revenue this month" value={formatMoney(recs.data!.metrics.revenue, sym)} tone="primary" icon={<TrendingUp className="h-4 w-4" />} />
                <StatCard label="Net profit" value={formatMoney(recs.data!.metrics.netProfit, sym)} tone={recs.data!.metrics.netProfit >= 0 ? "success" : "danger"} />
                <StatCard label="Overdue receivables" value={formatMoney(recs.data!.metrics.overdueReceivables, sym)} tone={recs.data!.metrics.overdueReceivables > 0 ? "danger" : "success"} />
                <StatCard label="Out of stock" value={String(recs.data!.metrics.outOfStock)} tone={recs.data!.metrics.outOfStock > 0 ? "warning" : "success"} />
              </div>

              <div className="space-y-3">
                {recs.data!.recommendations.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={PRIORITY_VARIANT[r.priority]}>{r.priority}</Badge>
                      <Badge variant="muted">{r.category}</Badge>
                      <h3 className="font-semibold text-navy">{r.title}</h3>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
                        <p className="mt-1 text-sm text-muted-foreground">{r.evidence}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Action</p>
                        <p className="mt-1 text-sm text-foreground">{r.action}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Impact</p>
                        <p className="mt-1 text-sm text-muted-foreground">{r.impact}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "ask" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
            <h3 className="flex items-center gap-2 font-semibold text-navy"><Sparkles className="h-4 w-4 text-primary" /> Ask about your business</h3>
            <p className="mt-1 text-sm text-muted-foreground">Answers are grounded in your recorded sales, expenses, stock and debts.</p>
            <div className="mt-4">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How can I improve my profit margin this month?"
                rows={3}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</p>
                <Button onClick={() => submit()} disabled={ask.isPending || question.trim().length < 3}>
                  {ask.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</> : <><Send className="h-4 w-4" /> Ask</>}
                </Button>
              </div>
            </div>

            {ask.isError && <div className="mt-4"><ErrorState message={ask.error.message} /></div>}

            {answer && (
              <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-navy">{answer.topicLabel}</span>
                  <Badge variant="muted" className="ml-auto">{answer.source === "llm" ? "AI" : "Rules engine"}</Badge>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{answer.answer}</div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-navy"><Lightbulb className="h-4 w-4 text-warning" /> Try asking</h3>
            <div className="mt-3 space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={ask.isPending}
                  className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {status.data?.configured
                  ? "A language model rewrites the analysis in prose. Every figure still comes from your data."
                  : "No AI key is configured, so answers come from the built-in rules engine — still grounded in your real numbers. Add OPENAI_API_KEY in Settings → Environment variables to enable the language layer."}
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <>
          {history.isLoading ? <LoadingState label="Loading your consultations…" /> : history.isError ? <ErrorState message={history.error.message} onRetry={() => history.refetch()} /> : history.data!.length === 0 ? (
            <EmptyState
              title="No questions asked yet"
              description="Ask the advisor a question and your consultation history will appear here."
              icon={<History className="h-6 w-6" />}
              action={<Button onClick={() => setTab("ask")}>Ask a question</Button>}
            />
          ) : (
            <div className="space-y-3">
              {history.data!.map((h) => (
                <div key={h.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2">
                    <Badge variant="muted">{h.topic ?? "general"}</Badge>
                    <span className="text-xs text-muted-foreground">{relativeTime(h.createdAt)}</span>
                    <Badge variant="outline" className="ml-auto">{h.source === "llm" ? "AI" : "Rules"}</Badge>
                  </div>
                  <p className="mt-3 font-medium text-navy">{h.question}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{h.answer}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" />
        The advisor gives business guidance from your own records. It is not legal, tax or investment advice.
      </p>
    </div>
  );
}
