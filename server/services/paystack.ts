// ── Paystack integration ─────────────────────────────────────────────────────
// Server-side only. The secret key NEVER reaches the browser. A transaction is
// only ever marked paid after an independent server-side verification call to
// Paystack — never because the customer returned from the payment page.
//
// Required env (set in Settings → Environment variables):
//   PAYSTACK_SECRET_KEY  (sk_...)  — server only
//   PAYSTACK_PUBLIC_KEY  (pk_...)  — safe to expose to the browser
//   APP_URL              — your deployed origin, used for callback URLs
//
// When the keys are absent the service reports `configured: false` and every
// call throws a clear error — it never fabricates a successful transaction.
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";

const PAYSTACK_BASE = "https://api.paystack.co";

export interface InitializeResult {
  authorizationUrl: string | null;
  accessCode: string | null;
  configured: boolean;
}

export interface VerifyResult {
  status: "success" | "failed" | "abandoned" | "unknown";
  amount?: number;
  currency?: string;
  id?: number | string;
  reference?: string;
  configured: boolean;
}

function secretKey(): string | null {
  try {
    return env.secret("PAYSTACK_SECRET_KEY");
  } catch {
    return null;
  }
}

export const paystack = {
  isConfigured(): boolean {
    return secretKey() !== null;
  },

  publicKey(): string | null {
    try {
      return env.config("PAYSTACK_PUBLIC_KEY");
    } catch {
      return null;
    }
  },

  appUrl(): string {
    try {
      return env.config("APP_URL");
    } catch {
      return "";
    }
  },

  /** Initialize a transaction. Returns the hosted checkout URL. */
  async initialize(input: {
    email: string;
    amount: number; // kobo
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<InitializeResult> {
    const key = secretKey();
    if (!key) {
      return { authorizationUrl: null, accessCode: null, configured: false };
    }
    const res = await outboundFetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        amount: input.amount,
        reference: input.reference,
        callback_url: this.appUrl() ? `${this.appUrl()}/app/finance` : undefined,
        metadata: input.metadata ?? {},
      }),
      timeoutMs: 15000,
    });
    const json = (await res.json()) as { status?: boolean; data?: { authorization_url?: string; access_code?: string } };
    if (!json.status || !json.data) {
      throw new Error("Paystack initialization failed");
    }
    return {
      authorizationUrl: json.data.authorization_url ?? null,
      accessCode: json.data.access_code ?? null,
      configured: true,
    };
  },

  /** Independently verify a transaction by reference. This is the ONLY source
   *  of truth for whether money actually arrived. */
  async verify(reference: string): Promise<VerifyResult> {
    const key = secretKey();
    if (!key) return { status: "unknown", configured: false };
    const res = await outboundFetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      timeoutMs: 15000,
    });
    const json = (await res.json()) as {
      status?: boolean;
      data?: { status?: string; amount?: number; currency?: string; id?: number; reference?: string };
    };
    const d = json.data;
    if (!json.status || !d) return { status: "unknown", configured: true };
    const status = d.status === "success" ? "success" : d.status === "abandoned" ? "abandoned" : "failed";
    return { status, amount: d.amount, currency: d.currency, id: d.id, reference: d.reference, configured: true };
  },

  /** Verify a webhook signature (HMAC SHA-512 of the raw body with the secret). */
  async verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
    const key = secretKey();
    if (!key || !signature) return false;
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(rawBody));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    // Constant-time-ish comparison.
    if (hex.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  },
};
