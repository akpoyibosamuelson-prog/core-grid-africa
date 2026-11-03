// ── Provider registry ─────────────────────────────────────────────────────────
// The single place a provider is named. Adding Flutterwave or Stripe later is:
//   1. write `flutterwave-provider.ts` implementing PaymentProvider,
//   2. import it below and add it to PROVIDERS.
// Everything else — routers, subscription activation, the settings UI — reads
// the active provider through `activeProvider()` and needs no change.
import { paystackProvider } from "./paystack-provider";
import type { PaymentProvider, ProviderId } from "./types";

const PROVIDERS: Record<ProviderId, PaymentProvider> = {
  paystack: paystackProvider,
};

/**
 * The provider online payments run through today.
 *
 * This is a single-provider deployment, so it is a constant rather than an env
 * lookup — but it is a FUNCTION, not a re-export, so the day a second provider
 * exists the choice can become data-driven without touching a single caller.
 */
export function activeProvider(): PaymentProvider {
  return PROVIDERS.paystack;
}

export function getProvider(id: ProviderId): PaymentProvider {
  return PROVIDERS[id];
}

export function listProviders(): PaymentProvider[] {
  return Object.values(PROVIDERS);
}

/** Summary safe to hand the browser: no secrets, only what the UI needs. */
export function providerStatus(): {
  id: ProviderId;
  label: string;
  configured: boolean;
  missing: string[];
  publicKey: string | null;
} {
  const p = activeProvider();
  return {
    id: p.id,
    label: p.label,
    configured: p.isConfigured(),
    missing: p.missingConfig(),
    publicKey: p.publicKey(),
  };
}

export * from "./types";
