import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Shared, controllable mock state. `vi.hoisted` runs before the module graph is
// imported, so the factories below can close over it.
const h = vi.hoisted(() => ({
  secrets: {} as Record<string, string>,
  configs: {} as Record<string, string>,
  dbRows: [] as unknown[],
}));

// env.secret/config THROW when a value is absent — that is the real contract
// (env.ts never falls back), and it is what makes "not configured" detectable.
vi.mock("./_core/env", () => ({
  env: {
    secret: (name: string) => {
      const v = h.secrets[name];
      if (!v) throw new Error(`missing secret ${name}`);
      return v;
    },
    config: (name: string) => {
      const v = h.configs[name];
      if (!v) throw new Error(`missing config ${name}`);
      return v;
    },
  },
}));

vi.mock("./_core/fetch", () => ({ outboundFetch: vi.fn() }));

vi.mock("./db", () => ({
  getPaymentByReference: vi.fn(),
  markPaymentVerified: vi.fn(),
  markPaymentFailed: vi.fn(),
  markPaymentAbandoned: vi.fn(),
  activateSubscription: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("./_core/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => h.dbRows }) }) }),
  },
}));

const { planPrice, PLANS } = await import("../shared/constants");
const { paystackProvider, verifyHmacSha512 } = await import("./services/payments/paystack-provider");
const { ProviderNotConfiguredError } = await import("./services/payments/types");
const { fulfilPayment } = await import("./services/payments/fulfill");
const { assertPlatformAdmin } = await import("./guards");
const q = await import("./db");

beforeEach(() => {
  h.secrets = {};
  h.configs = {};
  h.dbRows = [];
  vi.clearAllMocks();
});

// ── Server-authoritative pricing ─────────────────────────────────────────────
// The browser may ask for a plan; it may never name a price. These are the
// values the server charges, so a tampered request cannot buy Business for ₦1.
describe("planPrice (server-authoritative)", () => {
  it("returns the configured amount for each tier and period", () => {
    for (const p of PLANS) {
      expect(planPrice(p.tier, "MONTHLY")).toBe(p.monthly);
      expect(planPrice(p.tier, "ANNUAL")).toBe(p.annual);
    }
  });

  it("returns null for an unknown tier rather than a default price", () => {
    expect(planPrice("ENTERPRISE_PLUS", "MONTHLY")).toBeNull();
    expect(planPrice("", "ANNUAL")).toBeNull();
  });

  it("prices the Free plan at zero", () => {
    expect(planPrice("FREE", "MONTHLY")).toBe(0);
  });
});

// ── Provider configuration ───────────────────────────────────────────────────
describe("paystackProvider configuration", () => {
  it("reports not configured when the secret key is absent", () => {
    expect(paystackProvider.isConfigured()).toBe(false);
    expect(paystackProvider.missingConfig()).toContain("PAYSTACK_SECRET_KEY");
  });

  it("throws ProviderNotConfiguredError from initialize — never a fake success", async () => {
    await expect(
      paystackProvider.initialize({ email: "a@b.com", amount: 1000, reference: "ref-1" }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("throws ProviderNotConfiguredError from verify", async () => {
    await expect(paystackProvider.verify("ref-1")).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("reports configured once the secret key is present", () => {
    h.secrets.PAYSTACK_SECRET_KEY = "sk_test_x";
    expect(paystackProvider.isConfigured()).toBe(true);
  });

  it("never exposes the secret key as the public key", () => {
    h.secrets.PAYSTACK_SECRET_KEY = "sk_test_secret";
    h.configs.PAYSTACK_PUBLIC_KEY = "pk_test_public";
    expect(paystackProvider.publicKey()).toBe("pk_test_public");
    expect(paystackProvider.publicKey()).not.toContain("secret");
  });
});

// ── Webhook signature ────────────────────────────────────────────────────────
describe("verifyHmacSha512", () => {
  async function sign(body: string, secret: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("accepts a signature computed with the same secret", async () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "r1" } });
    const sig = await sign(body, "sk_test_x");
    expect(await verifyHmacSha512(body, "sk_test_x", sig)).toBe(true);
  });

  it("rejects a signature computed with a different secret", async () => {
    const body = "{}";
    const sig = await sign(body, "sk_other");
    expect(await verifyHmacSha512(body, "sk_test_x", sig)).toBe(false);
  });

  it("rejects a tampered body", async () => {
    const sig = await sign("{}", "sk_test_x");
    expect(await verifyHmacSha512('{"amount":1}', "sk_test_x", sig)).toBe(false);
  });
});

// ── Fulfilment rules ─────────────────────────────────────────────────────────
// The single place a verification result becomes a settled payment. Both the
// verify procedure and the webhook route go through it, so these rules cannot
// drift between the two paths.
describe("fulfilPayment", () => {
  const pending = {
    id: "p1", businessId: "b1", type: "SUBSCRIPTION", reference: "ref-1",
    amount: 500000, status: "PENDING", plan: "BUSINESS", billingPeriod: "MONTHLY",
  };

  it("ignores an unknown reference", async () => {
    vi.mocked(q.getPaymentByReference).mockResolvedValueOnce(null as never);
    const out = await fulfilPayment("ref-x", { status: "success", amount: 1 });
    expect(out.outcome).toBe("unknown_reference");
    expect(q.markPaymentVerified).not.toHaveBeenCalled();
  });

  it("never re-settles an already-successful payment (duplicate prevention)", async () => {
    vi.mocked(q.getPaymentByReference).mockResolvedValueOnce({ ...pending, status: "SUCCESS" } as never);
    const out = await fulfilPayment("ref-1", { status: "success", amount: 500000 });
    expect(out.outcome).toBe("already_settled");
    expect(q.markPaymentVerified).not.toHaveBeenCalled();
    expect(q.activateSubscription).not.toHaveBeenCalled();
  });

  it("refuses a success whose settled amount does not match our record", async () => {
    vi.mocked(q.getPaymentByReference).mockResolvedValueOnce(pending as never);
    const out = await fulfilPayment("ref-1", { status: "success", amount: 100 });
    expect(out.outcome).toBe("amount_mismatch");
    expect(q.markPaymentVerified).not.toHaveBeenCalled();
    expect(q.markPaymentFailed).toHaveBeenCalled();
  });

  it("records a failed provider result as FAILED", async () => {
    vi.mocked(q.getPaymentByReference).mockResolvedValueOnce(pending as never);
    const out = await fulfilPayment("ref-1", { status: "failed", reason: "Insufficient funds" });
    expect(out.outcome).toBe("failed");
    expect(q.markPaymentFailed).toHaveBeenCalled();
    expect(q.markPaymentVerified).not.toHaveBeenCalled();
  });

  it("settles a matching success and activates the subscription", async () => {
    vi.mocked(q.getPaymentByReference).mockResolvedValueOnce(pending as never);
    vi.mocked(q.markPaymentVerified).mockResolvedValueOnce({ id: "p1" } as never);
    vi.mocked(q.activateSubscription).mockResolvedValueOnce({ expiresAt: new Date() } as never);
    const out = await fulfilPayment("ref-1", { status: "success", amount: 500000, providerRef: "99" });
    expect(out.outcome).toBe("settled");
    expect(out.plan).toBe("BUSINESS");
    expect(q.activateSubscription).toHaveBeenCalledWith("b1", expect.objectContaining({ plan: "BUSINESS" }));
  });

  it("treats a lost race (guarded update returns null) as already settled", async () => {
    vi.mocked(q.getPaymentByReference).mockResolvedValueOnce(pending as never);
    vi.mocked(q.markPaymentVerified).mockResolvedValueOnce(null as never);
    const out = await fulfilPayment("ref-1", { status: "success", amount: 500000 });
    expect(out.outcome).toBe("already_settled");
    expect(q.activateSubscription).not.toHaveBeenCalled();
  });
});

// ── Server-side admin authorisation ──────────────────────────────────────────
// The real gate. Hiding a menu item is presentation; this re-reads the role
// from the database on every request.
describe("assertPlatformAdmin", () => {
  it("refuses an anonymous caller", async () => {
    await expect(assertPlatformAdmin(null)).rejects.toBeInstanceOf(TRPCError);
  });

  it("refuses a signed-in non-admin", async () => {
    h.dbRows = [{ id: "u1", email: "user@x.com", name: "User", role: "user" }];
    const err = await assertPlatformAdmin({ id: "u1", email: "user@x.com", name: "User", role: "user" } as never).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  it("refuses a caller whose session claims admin but whose DB role is not", async () => {
    h.dbRows = [{ id: "u1", email: "user@x.com", name: "User", role: "user" }];
    const err = await assertPlatformAdmin({ id: "u1", email: "user@x.com", name: "User", role: "admin" } as never).catch((e) => e);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  it("allows a real platform administrator", async () => {
    h.dbRows = [{ id: "u1", email: "owner@x.com", name: "Owner", role: "admin" }];
    const out = await assertPlatformAdmin({ id: "u1", email: "owner@x.com", name: "Owner", role: "admin" } as never);
    expect(out.role).toBe("admin");
  });
});
