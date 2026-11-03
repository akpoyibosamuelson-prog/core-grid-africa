// ── Inventory intelligence ───────────────────────────────────────────────────
// Turns raw stock + sales history into decisions: what is fast, what is dead,
// when to reorder and how much. Every number is derived from the business's own
// rows over a lookback window — nothing is assumed.
import { and, eq, gte, sql, sum } from "drizzle-orm";
import { db } from "./_core/db";
import { products, saleItems, sales } from "../drizzle/schema";

export type StockClass = "FAST" | "MEDIUM" | "SLOW" | "DEAD";
export type StockStatus = "OUT" | "LOW" | "OK" | "OVERSTOCK";

export interface ProductIntelligence {
  productId: string;
  name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  minStockLevel: number;
  safetyStock: number;
  supplierLeadTimeDays: number;
  costPrice: number;
  retailPrice: number;
  expiryDate: Date | null;
  unitsSold: number;
  revenue: number;
  dailyVelocity: number;
  daysOfStock: number | null;
  reorderPoint: number;
  recommendedRestock: number;
  classification: StockClass;
  status: StockStatus;
  stockValue: number;
  expiryDays: number | null;
}

/**
 * Reorder point = demand expected during the supplier's lead time, plus the
 * safety buffer. Below this, a reorder should already be on its way.
 */
export function reorderPointFor(dailyVelocity: number, leadTimeDays: number, safetyStock: number): number {
  return Math.ceil(dailyVelocity * Math.max(0, leadTimeDays)) + Math.max(0, safetyStock);
}

/**
 * How many units to order: enough to cover the lead time plus a cover window of
 * normal demand, on top of safety stock, less what is already on hand.
 */
export function recommendedRestockFor(
  quantity: number,
  dailyVelocity: number,
  leadTimeDays: number,
  safetyStock: number,
  coverDays = 30,
): number {
  const target = Math.ceil(dailyVelocity * (Math.max(0, leadTimeDays) + coverDays)) + Math.max(0, safetyStock);
  return Math.max(0, target - quantity);
}

/**
 * Classify products by units sold over the window, relative to each other:
 * top 30% FAST, bottom 30% (that sold at all) SLOW, nothing sold DEAD.
 * With fewer than 3 selling products there is no distribution to rank against,
 * so everything that sold is MEDIUM rather than arbitrarily "fast".
 */
export function classifyVelocities(unitsSold: number[]): StockClass[] {
  const out: StockClass[] = unitsSold.map((u) => (u <= 0 ? "DEAD" : "MEDIUM"));
  const selling = unitsSold.filter((u) => u > 0).sort((a, b) => a - b);
  if (selling.length < 3) return out;
  const q = (p: number) => selling[Math.min(selling.length - 1, Math.floor(p * selling.length))];
  const fastCut = q(0.7);
  const slowCut = q(0.3);
  return unitsSold.map((u) => {
    if (u <= 0) return "DEAD";
    if (fastCut > 0 && u >= fastCut) return "FAST";
    if (u <= slowCut) return "SLOW";
    return "MEDIUM";
  });
}

export interface InventoryIntelligence {
  rows: ProductIntelligence[];
  summary: {
    totalProducts: number;
    stockValue: number;
    fastMoving: number;
    slowMoving: number;
    deadStock: number;
    deadStockValue: number;
    lowStock: number;
    outOfStock: number;
    overstock: number;
    needsRestock: number;
    expiringSoon: number;
    windowDays: number;
  };
}

export async function inventoryIntelligence(businessId: string, windowDays = 30): Promise<InventoryIntelligence> {
  const from = new Date(Date.now() - windowDays * 86_400_000);

  const [prods, sold] = await Promise.all([
    db.select().from(products).where(eq(products.businessId, businessId)).orderBy(products.name),
    db
      .select({
        productId: saleItems.productId,
        units: sum(saleItems.quantity).mapWith(Number),
        revenue: sum(saleItems.lineTotal).mapWith(Number),
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.status, "COMPLETED"),
          gte(sales.createdAt, from),
          sql`${saleItems.productId} is not null`,
        ),
      )
      .groupBy(saleItems.productId),
  ]);

  const soldMap = new Map(sold.map((s) => [s.productId, s]));
  const units = prods.map((p) => soldMap.get(p.id)?.units ?? 0);
  const classes = classifyVelocities(units);
  const now = Date.now();

  const rows: ProductIntelligence[] = prods.map((p, i) => {
    const unitsSold = units[i];
    const dailyVelocity = unitsSold / windowDays;
    const daysOfStock = dailyVelocity > 0 ? Math.round((p.quantity / dailyVelocity) * 10) / 10 : null;
    const reorderPoint = reorderPointFor(dailyVelocity, p.supplierLeadTimeDays, p.safetyStock);
    const recommendedRestock = recommendedRestockFor(p.quantity, dailyVelocity, p.supplierLeadTimeDays, p.safetyStock);
    const status: StockStatus =
      p.quantity <= 0
        ? "OUT"
        : p.quantity <= p.minStockLevel
          ? "LOW"
          : daysOfStock !== null && daysOfStock > 120
            ? "OVERSTOCK"
            : "OK";
    const expiryDays = p.expiryDate ? Math.ceil((new Date(p.expiryDate).getTime() - now) / 86_400_000) : null;
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      quantity: p.quantity,
      minStockLevel: p.minStockLevel,
      safetyStock: p.safetyStock,
      supplierLeadTimeDays: p.supplierLeadTimeDays,
      costPrice: p.costPrice,
      retailPrice: p.retailPrice,
      expiryDate: p.expiryDate,
      unitsSold,
      revenue: soldMap.get(p.id)?.revenue ?? 0,
      dailyVelocity: Math.round(dailyVelocity * 100) / 100,
      daysOfStock,
      reorderPoint,
      recommendedRestock,
      classification: classes[i],
      status,
      stockValue: p.quantity * p.costPrice,
      expiryDays,
    };
  });

  const summary = {
    totalProducts: rows.length,
    stockValue: rows.reduce((s, r) => s + r.stockValue, 0),
    fastMoving: rows.filter((r) => r.classification === "FAST").length,
    slowMoving: rows.filter((r) => r.classification === "SLOW").length,
    deadStock: rows.filter((r) => r.classification === "DEAD" && r.quantity > 0).length,
    deadStockValue: rows.filter((r) => r.classification === "DEAD").reduce((s, r) => s + r.stockValue, 0),
    lowStock: rows.filter((r) => r.status === "LOW").length,
    outOfStock: rows.filter((r) => r.status === "OUT").length,
    overstock: rows.filter((r) => r.status === "OVERSTOCK").length,
    needsRestock: rows.filter((r) => r.recommendedRestock > 0 && r.classification !== "DEAD").length,
    expiringSoon: rows.filter((r) => r.expiryDays !== null && r.expiryDays <= 30).length,
    windowDays,
  };

  return { rows, summary };
}
