import { describe, expect, it, vi } from "vitest";

// The pure engines (analytics, inventory-intel, advisor) import _core/db, which
// builds a real driver from env at module load. Mock the driver leaf so the
// pure functions can be exercised without a database — the same pattern
// routers.test.ts uses for the _core leaves.
vi.mock("./_core/db", () => ({ db: {}, atomic: vi.fn(), schema: {} }));

const { growthPct } = await import("./analytics");
const { reorderPointFor, recommendedRestockFor, classifyVelocities } = await import("./inventory-intel");
const { computeHealth } = await import("./advisor");
import type { AdvisorMetrics } from "./advisor";

// ── analytics: growth ────────────────────────────────────────────────────────
describe("growthPct", () => {
  it("computes a normal percentage change", () => {
    expect(growthPct(150, 100)).toBeCloseTo(0.5);
    expect(growthPct(50, 100)).toBeCloseTo(-0.5);
  });

  it("returns 0 when both periods are zero (no change, not a divide-by-zero)", () => {
    expect(growthPct(0, 0)).toBe(0);
  });

  it("returns null when the previous period was zero but the current is not", () => {
    // Growth from nothing is undefined, not infinite — the UI shows "new".
    expect(growthPct(100, 0)).toBeNull();
  });

  it("uses the absolute value of the previous period so a negative base still reads correctly", () => {
    expect(growthPct(-50, -100)).toBeCloseTo(0.5);
  });
});

// ── inventory intelligence: reorder maths ────────────────────────────────────
describe("reorderPointFor", () => {
  it("covers demand over the lead time plus the safety buffer", () => {
    // 2/day * 7 days + 5 safety = 19
    expect(reorderPointFor(2, 7, 5)).toBe(19);
  });

  it("rounds up so a fractional velocity never under-orders", () => {
    // 0.5/day * 3 days = 1.5 → 2, + 0 safety
    expect(reorderPointFor(0.5, 3, 0)).toBe(2);
  });

  it("treats a negative lead time or safety stock as zero", () => {
    expect(reorderPointFor(2, -5, -3)).toBe(0);
  });
});

describe("recommendedRestockFor", () => {
  it("orders enough to cover lead time + cover window + safety, less what is on hand", () => {
    // target = ceil(2 * (7 + 30)) + 5 = 79; on hand 10 → 69
    expect(recommendedRestockFor(10, 2, 7, 5, 30)).toBe(69);
  });

  it("never recommends a negative order when stock already exceeds the target", () => {
    expect(recommendedRestockFor(1000, 1, 7, 0, 30)).toBe(0);
  });
});

describe("classifyVelocities", () => {
  it("marks anything that did not sell as DEAD", () => {
    const out = classifyVelocities([0, 0, 5, 10, 20]);
    expect(out[0]).toBe("DEAD");
    expect(out[1]).toBe("DEAD");
  });

  it("ranks the top sellers FAST and the bottom sellers SLOW", () => {
    const out = classifyVelocities([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out[9]).toBe("FAST");
    expect(out[0]).toBe("SLOW");
  });

  it("does not invent a distribution from fewer than three selling products", () => {
    // With 1-2 sellers there is nothing to rank against, so they are MEDIUM.
    const out = classifyVelocities([0, 3, 7]);
    expect(out[1]).toBe("MEDIUM");
    expect(out[2]).toBe("MEDIUM");
  });
});

// ── advisor: health score ────────────────────────────────────────────────────
function metrics(overrides: Partial<AdvisorMetrics> = {}): AdvisorMetrics {
  return {
    period: { from: new Date("2026-11-01"), to: new Date("2026-11-30") },
    revenue: 1_000_000,
    cogs: 600_000,
    grossProfit: 400_000,
    grossMargin: 0.4,
    expenses: 200_000,
    netProfit: 200_000,
    netMargin: 0.2,
    cashCollected: 900_000,
    receivables: 100_000,
    payables: 50_000,
    salesCount: 40,
    avgSaleValue: 25_000,
    revenueGrowth: 0.1,
    expenseGrowth: 0.05,
    inventoryValue: 500_000,
    lowStock: 0,
    outOfStock: 0,
    deadStock: 0,
    deadStockValue: 0,
    fastMoving: 5,
    totalProducts: 20,
    overdueReceivables: 0,
    overdueCount: 0,
    activeCustomers: 15,
    newCustomers: 3,
    returningCustomers: 12,
    unusualExpenseCount: 0,
    cashNet: 100_000,
    ...overrides,
  };
}

describe("computeHealth", () => {
  it("returns six weighted dimensions and an overall score in 0..100", () => {
    const report = computeHealth(metrics());
    expect(report.dimensions).toHaveLength(6);
    expect(report.overall).toBeGreaterThanOrEqual(0);
    expect(report.overall).toBeLessThanOrEqual(100);
    expect(report.grade).toBeTruthy();
  });

  it("scores a healthy business higher than a distressed one", () => {
    const healthy = computeHealth(metrics());
    const distressed = computeHealth(
      metrics({
        revenue: 100_000,
        grossProfit: 5_000,
        grossMargin: 0.05,
        netProfit: -50_000,
        netMargin: -0.5,
        revenueGrowth: -0.4,
        outOfStock: 8,
        lowStock: 6,
        deadStock: 10,
        deadStockValue: 300_000,
        overdueReceivables: 400_000,
        overdueCount: 9,
        cashNet: -80_000,
      }),
    );
    expect(healthy.overall).toBeGreaterThan(distressed.overall);
  });

  it("is deterministic — the same metrics always score the same", () => {
    const a = computeHealth(metrics());
    const b = computeHealth(metrics());
    expect(a.overall).toBe(b.overall);
  });

  it("weights sum to 1 so the overall score is a true weighted average", () => {
    const report = computeHealth(metrics());
    const total = report.dimensions.reduce((s, d) => s + d.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});
