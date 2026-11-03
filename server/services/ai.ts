// ── Secure server-side AI access ─────────────────────────────────────────────
// The advisor's language layer. The API key lives ONLY here, read through
// env.secret() from the app owner's Settings → Environment variables, and is
// never sent to the browser. When no key is configured this returns null and
// the caller falls back to the deterministic rules engine — it never pretends
// a model answered when one did not.
//
// Optional env (Settings → Environment variables):
//   OPENAI_API_KEY   sk-…            — server only
//   OPENAI_MODEL     gpt-4o-mini     — optional, defaults to gpt-4o-mini
//   OPENAI_BASE_URL  https://…/v1    — optional, for an OpenAI-compatible host
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";

export function aiConfigured(): boolean {
  try {
    return Boolean(env.secret("OPENAI_API_KEY"));
  } catch {
    return false;
  }
}

export function aiModel(): string {
  try {
    return env.config("OPENAI_MODEL", "gpt-4o-mini");
  } catch {
    return "gpt-4o-mini";
  }
}

/**
 * One grounded completion. Returns null on any failure (no key, network, a
 * non-2xx, an empty answer) so the caller can fall back rather than surface a
 * half-answer. Never throws.
 */
export async function aiComplete(system: string, user: string, maxTokens = 800): Promise<string | null> {
  let key: string;
  try {
    key = env.secret("OPENAI_API_KEY");
  } catch {
    return null;
  }

  let base = "https://api.openai.com/v1";
  try {
    base = env.config("OPENAI_BASE_URL", base);
  } catch {
    /* keep the default */
  }

  try {
    const res = await outboundFetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
      timeoutMs: 30_000,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
