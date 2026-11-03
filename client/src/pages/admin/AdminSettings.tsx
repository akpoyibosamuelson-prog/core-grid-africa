import { useState } from "react";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { PageHeader, LoadingState, ErrorState } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/_core/trpc";
import { useToast } from "@/components/ui/toast";

export default function AdminSettings() {
  const { push } = useToast();
  const q = trpc.admin.settings.useQuery();
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const setSetting = trpc.admin.setSetting.useMutation({ onSuccess: () => { push({ kind: "success", title: "Setting saved" }); void utils.admin.settings.invalidate(); }, onError: (e) => push({ kind: "error", title: "Failed", message: e.message }) });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Settings" description="Global configuration for Core Grid Africa" />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><SettingsIcon className="mx-auto mb-2 h-6 w-6" /> No platform settings configured.</div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {rows.map((s) => (
            <div key={s.key} className="rounded-xl border border-border bg-card p-5">
              <Label className="capitalize">{s.key.replace(/_/g, " ")}</Label>
              <div className="mt-2 flex gap-2">
                <Input value={draft[s.key] ?? s.value} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} />
                <Button onClick={() => setSetting.mutate({ key: s.key, value: draft[s.key] ?? s.value })} disabled={setSetting.isPending}><Save className="h-4 w-4" /> Save</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
