// ── Payment provider contract ─────────────────────────────────────────────────
// Every provider (Paystack today; Flutterwave/Stripe later) implements this
// interface. Nothing above this layer knows a provider exists by name: the
// router resolves one from the registry and talks to it through these types.
//
// SECURITY INVARIANTS (enforced by the callers, restated here because they are
// the whole point of the abstraction):
//   1. A transaction is NEVER marked paid because the browser came back from a
//      hosted checkout page. Only `verify()` — an independent server-to-server
//      call — can produce status "success".
//   2. `verify()` must report the AMOUNT and CURRENCY the provider actually
//      settled. The caller compares them to its own record; a mismatch is a
//      hard failure, not a rounding difference.
//   3. A webhook is a TRIGGER to re-verify, never proof. Its signature is
//      checked first and its payload is never trusted on its own.

export type ProviderId = "paystack";

/** Normalised transaction state across providers. */
export type ProviderTxStatus = "success" | "failed" | "abandoned" | "pending" | "unknown";

export interface InitializeInput {
  /** Customer email the receipt is addressed to. */
  email: string;
  /** Amount in the smallest currency unit (kobo for NGN). Integer. */
  amount: number;
  /** Our own unique reference; sent to the provider and echoed back. */
  reference: string;
  currency?: string;
  /** Arbitrary correlation data returned to us on verification. */
  metadata?: Record<string, unknown>;
  /** Where the provider should send the customer after checkout. */
  callbackUrl?: string;
}

export interface InitializeResult {
  authorizationUrl: string | null;
  accessCode: string | null;
}

export interface VerifyResult {
  status: ProviderTxStatus;
  /** Amount actually settled, in the smallest unit. Compare before trusting. */
  amount?: number;
  currency?: string;
  /** Provider's own transaction id. */
  providerRef?: string;
  reference?: string;
  /** Human-readable reason for a non-success status, safe to show a user. */
  reason?: string;
  /** Non-sensitive provider detail for the audit trail (channel, gateway code). */
  meta?: Record<string, unknown>;
}

export interface WebhookEvent {
  /** The provider's event name, e.g. "charge.success". */
  event: string;
  reference?: string;
  /** Verified payload, kept for the audit trail. Never contains card data. */
  raw?: Record<string, unknown>;
}

/** Thrown when a provider is asked to do something without being configured. */
export class ProviderNotConfiguredError extends Error {
  constructor(readonly provider: ProviderId, missing: string[]) {
    super(
      `${provider} is not configured — set ${missing.join(", ")} in Settings → Environment variables.`,
    );
    this.name = "ProviderNotConfiguredError";
  }
}

/** Thrown when a provider call fails at the network/API level. */
export class ProviderRequestError extends Error {
  constructor(
    readonly provider: ProviderId,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** True only when every credential this provider needs is present. */
  isConfigured(): boolean;
  /** Names of the env vars still missing — shown to the owner. */
  missingConfig(): string[];
  /** Public (browser-safe) key, or null. Never a secret. */
  publicKey(): string | null;
  initialize(input: InitializeInput): Promise<InitializeResult>;
  verify(reference: string): Promise<VerifyResult>;
  /**
   * Verify a webhook's authenticity. Returns the parsed event on success, or
   * null when the signature is absent/invalid — the caller must then refuse.
   */
  parseWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<WebhookEvent | null>;
}
