// ── Paystack provider ─────────────────────────────────────────────────────────
// Server-side only. PAYSTACK_SECRET_KEY never leaves this process: it is read
// through env.secret(), which throws rather than falling back to anything, and
// it is never included in a response.
//
// Required env (Settings → Environment variables):
//   PAYSTACK_SECRET_KEY   sk_live_… / sk_test_…   — server only
//   PAYSTACK_PUBLIC_KEY   pk_live_… / pk_test_…   — safe for the browser
//   APP_URL               https://your-domain     — callback + webhook origin
//
// WHEN THE KEYS ARE ABSENT this provider reports configured: false and throws
// ProviderNotConfiguredError from initialize/verify. It NEVER fabricates a
// successful transaction to make a demo look finished.
import { env } from "../../_core/env";
import { outboundFetch } from "../../_core/fetch";
import {
  ProviderNotConfiguredError,
  ProviderRequestError,
  type InitializeInput,
  type InitializeResult,
  type PaymentProvider,
  type VerifyResult,
  type WebhookEvent,
} from "./types";

const API_BASE = "https://api.paystack.co";
const PROVIDER = "paystack" as const;

const REQUIRED_SECRETS = ["PAYSTACK_SECRET_KEY"] as const;
const OPTIONAL_CONFIG = ["PAYSTACK_PUBLIC_KEY", "APP_URL"] as const;

function readSecret(name: string): string | null {
  try {
    return env.secret(name);
  } catch {
    return null;
  }
}

function readConfig(name: string): string | null {
  try {
    return env.config(name);
  } catch {
    return null;
  }
}

/** Map Paystack's transaction status onto our normalised set. */
function normaliseStatus(raw: string | undefined): VerifyResult["status"] {
  switch (raw) {
    case "success":
      return "success";
    case "abandoned":
      return "abandoned";
    case "failed":
    case "reversed":
      return "failed";
    case "ongoing":
    case "pending":
    case "queued":
      return "pending";
    default:
      return "unknown";
  }
}

async function callPaystack(
  path: string,
  key: string,
  init?: { method: string; body?: unknown },
): Promise<{ status: boolean; message?: string; data?: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await outboundFetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      timeoutMs: 20_000,
    });
  } catch (e) {
    // A timeout or DNS failure. Reported as its own type so the router can say
    // "the provider did not answer" instead of "your card failed".
    throw new ProviderRequestError(PROVIDER, "Could not reach Paystack. Try again.", e);
  }

  let json: { status?: boolean; message?: string; data?: Record<string, unknown> } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new ProviderRequestError(PROVIDER, `Paystack returned an unreadable response (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    throw new ProviderRequestError(
      PROVIDER,
      json.message ?? `Paystack rejected the request (HTTP ${res.status}).`,
    );
  }
  return { status: json.status === true, message: json.message, data: json.data };
}

export const paystackProvider: PaymentProvider = {
  id: PROVIDER,
  label: "Paystack",

  isConfigured(): boolean {
    return readSecret("PAYSTACK_SECRET_KEY") !== null;
  },

  missingConfig(): string[] {
    return [...REQUIRED_SECRETS, ...OPTIONAL_CONFIG].filter((name) =>
      name === "PAYSTACK_SECRET_KEY" ? readSecret(name) === null : readConfig(name) === null,
    );
  },

  publicKey(): string | null {
    return readConfig("PAYSTACK_PUBLIC_KEY");
  },

  async initialize(input: InitializeInput): Promise<InitializeResult> {
    const key = readSecret("PAYSTACK_SECRET_KEY");
    if (!key) throw new ProviderNotConfiguredError(PROVIDER, ["PAYSTACK_SECRET_KEY"]);

    const appUrl = readConfig("APP_URL");
    const result = await callPaystack("/transaction/initialize", key, {
      method: "POST",
      body: {
        email: input.email,
        amount: input.amount,
        reference: input.reference,
        currency: input.currency ?? "NGN",
        // Built from APP_URL, never from the request's Host header: a callback
        // URL derived from an attacker-supplied Host would let them redirect a
        // verifiable payment flow.
        ...(appUrl ? { callback_url: `${appUrl.replace(/\/+$/, "")}/app/settings?tab=subscription` } : {}),
        metadata: input.metadata ?? {},
      },
    });

    if (!result.status || !result.data) {
      throw new ProviderRequestError(PROVIDER, result.message ?? "Paystack could not start the transaction.");
    }
    return {
      authorizationUrl: (result.data.authorization_url as string | undefined) ?? null,
      accessCode: (result.data.access_code as string | undefined) ?? null,
    };
  },

  async verify(reference: string): Promise<VerifyResult> {
    const key = readSecret("PAYSTACK_SECRET_KEY");
    if (!key) throw new ProviderNotConfiguredError(PROVIDER, ["PAYSTACK_SECRET_KEY"]);

    const result = await callPaystack(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      key,
    );

    // A 200 with status:false means Paystack could not find/claim the
    // reference. That is "unknown", not "success" — never the other way round.
    if (!result.status || !result.data) {
      return { status: "unknown", reason: result.message ?? "Transaction not found." };
    }

    const d = result.data;
    const status = normaliseStatus(typeof d.status === "string" ? d.status : undefined);
    const gateway = d.gateway_response;

    return {
      status,
      amount: typeof d.amount === "number" ? d.amount : undefined,
      currency: typeof d.currency === "string" ? d.currency : undefined,
      providerRef: d.id === undefined ? undefined : String(d.id),
      reference,
      reason:
        status === "success"
          ? undefined
          : typeof gateway === "string" && gateway
            ? gateway
            : `Payment ${status}.`,
      meta: {
        channel: d.channel,
        gatewayResponse: gateway,
        paidAt: d.paid_at,
        // Card metadata is deliberately reduced to the non-sensitive parts.
        cardType: (d.authorization as Record<string, unknown> | undefined)?.card_type,
        bank: (d.authorization as Record<string, unknown> | undefined)?.bank,
      },
    };
  },

  async parseWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): Promise<WebhookEvent | null> {
    const key = readSecret("PAYSTACK_SECRET_KEY");
    // No key means we cannot verify a signature, so nothing can be trusted.
    if (!key) return null;

    const signature = headers["x-paystack-signature"];
    if (!signature) return null;

    const valid = await verifyHmacSha512(rawBody, key, signature);
    if (!valid) return null;

    let parsed: { event?: string; data?: { reference?: string } };
    try {
      parsed = JSON.parse(rawBody) as typeof parsed;
    } catch {
      return null;
    }
    if (!parsed.event) return null;

    return {
      event: parsed.event,
      reference: parsed.data?.reference,
      raw: parsed as Record<string, unknown>,
    };
  },
};

/**
 * Constant-time-ish HMAC-SHA512 comparison. Uses WebCrypto, which is available
 * in both the Node runtime here and any edge target, so this stays portable.
 */
export async function verifyHmacSha512(
  rawBody: string,
  secret: string,
  signature: string,
): Promise<boolean> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i += 1) {
    diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
