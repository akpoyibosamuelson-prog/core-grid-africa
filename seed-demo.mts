import "dotenv/config";
import { registerLocalUser } from "./server/_core/auth";
import * as q from "./server/db";
import { db } from "./server/_core/db";
import { sales, purchases, products } from "./drizzle/schema";
import { eq } from "drizzle-orm";

const EMAIL = "demo.owner@coregrid.test";
const PASSWORD = "DemoPass123!";

async function main() {
  // 1. User (idempotent — reuse if it already exists).
  let userId: string;
  try {
    const u = await registerLocalUser(EMAIL, PASSWORD, "Demo Owner");
    userId = u.id;
    console.log("created user", userId);
  } catch {
    const rows = await db.select().from((await import("./drizzle/schema")).users).where(eq((await import("./drizzle/schema")).users.email, EMAIL));
    userId = rows[0].id;
    console.log("reused user", userId);
  }

  // 2. Business.
  const biz = await q.createBusinessWithOwner({
    ownerId: userId,
    name: "Demo Provisions Ltd",
    slug: `demo-provisions-${Date.now()}`,
    industry: "Retail & Distribution",
    city: "Lagos",
    state: "Lagos",
  });
  // createBusinessWithOwner returns the atomic batch result (an array); the
  // business row is the first entry.
  const businessId = (Array.isArray(biz) ? biz[0] : biz).id;
  console.log("business", businessId);

  // 3. Suppliers + customers.
  const sup = await q.createSupplier(businessId, { name: "Lagos Wholesale Depot", phone: "08030000001" });
  const c1 = await q.createCustomer(businessId, { name: "Ade Supermarket", phone: "08030000002" });
  const c2 = await q.createCustomer(businessId, { name: "Chidi Stores", phone: "08030000003" });
  const c3 = await q.createCustomer(businessId, { name: "Walk-in Buyer", phone: "08030000004" });

  // 4. Products — a mix of fast, slow, dead, low and out-of-stock, plus one expiring.
  // createProduct returns the atomic batch result (an array); unwrap the row.
  const one = <T,>(r: T | T[]): T => (Array.isArray(r) ? r[0] : r);
  const p1 = one(await q.createProduct(businessId, { name: "Rice 50kg Bag", sku: "RICE50", unit: "bag", costPrice: 4_500_000, retailPrice: 5_200_000, quantity: 40, minStockLevel: 10, safetyStock: 5, supplierLeadTimeDays: 7, supplierId: sup.id }));
  const p2 = one(await q.createProduct(businessId, { name: "Vegetable Oil 5L", sku: "OIL5", unit: "pc", costPrice: 900_000, retailPrice: 1_150_000, quantity: 6, minStockLevel: 12, safetyStock: 6, supplierLeadTimeDays: 5, supplierId: sup.id }));
  const p3 = one(await q.createProduct(businessId, { name: "Tomato Paste Carton", sku: "TOMCTN", unit: "carton", costPrice: 1_200_000, retailPrice: 1_500_000, quantity: 0, minStockLevel: 5, safetyStock: 3, supplierLeadTimeDays: 4, supplierId: sup.id }));
  const p4 = one(await q.createProduct(businessId, { name: "Detergent 1kg", sku: "DET1", unit: "pc", costPrice: 250_000, retailPrice: 350_000, quantity: 120, minStockLevel: 20, safetyStock: 10, supplierLeadTimeDays: 6, supplierId: sup.id }));
  const p5 = one(await q.createProduct(businessId, { name: "Seasoning Cubes (slow)", sku: "SEAS", unit: "pack", costPrice: 80_000, retailPrice: 120_000, quantity: 200, minStockLevel: 10, safetyStock: 5, supplierLeadTimeDays: 6, supplierId: sup.id }));
  const p6 = one(await q.createProduct(businessId, { name: "Milk Powder Tin", sku: "MILK", unit: "tin", costPrice: 700_000, retailPrice: 900_000, quantity: 30, minStockLevel: 8, safetyStock: 4, supplierLeadTimeDays: 5, supplierId: sup.id, expiryDate: new Date(Date.now() + 18 * 86_400_000) }));

  // 5. Sales across the last ~40 days so trends and comparisons have data.
  const day = 86_400_000;
  const salePlan: { daysAgo: number; customerId: string; items: { p: { id: string; name: string }; qty: number; price: number; cost: number }[]; paid: number; dueInDays?: number }[] = [];
  const mk = (p: { id: string; name: string }, qty: number, price: number, cost: number) => ({ p, qty, price, cost });

  for (let i = 0; i < 12; i++) {
    salePlan.push({
      daysAgo: 38 - i * 3,
      customerId: [c1.id, c2.id, c3.id][i % 3],
      items: [mk(p1, 2, 5_200_000, 4_500_000), mk(p4, 5, 350_000, 250_000)],
      paid: i % 4 === 0 ? 0 : 5_200_000 * 2 + 350_000 * 5,
      dueInDays: i % 4 === 0 ? -10 : 14,
    });
  }
  for (let i = 0; i < 8; i++) {
    salePlan.push({
      daysAgo: 20 - i * 2,
      customerId: [c1.id, c2.id][i % 2],
      items: [mk(p6, 3, 900_000, 700_000), mk(p2, 2, 1_150_000, 900_000)],
      paid: 900_000 * 3 + 1_150_000 * 2,
      dueInDays: 10,
    });
  }
  // A couple of slow-mover sales so p5 is SLOW, not DEAD.
  salePlan.push({ daysAgo: 15, customerId: c3.id, items: [mk(p5, 2, 120_000, 80_000)], paid: 240_000, dueInDays: 7 });
  salePlan.push({ daysAgo: 5, customerId: c3.id, items: [mk(p5, 1, 120_000, 80_000)], paid: 120_000, dueInDays: 7 });

  let ref = 1000;
  const stock = new Map<string, number>([[p1.id, 40], [p2.id, 6], [p3.id, 0], [p4.id, 120], [p5.id, 200], [p6.id, 30]]);
  for (const s of salePlan) {
    const createdAt = new Date(Date.now() - s.daysAgo * day);
    const total = s.items.reduce((a, it) => a + it.qty * it.price, 0);
    const costTotal = s.items.reduce((a, it) => a + it.qty * it.cost, 0);
    const paid = Math.min(s.paid, total);
    const balance = total - paid;
    const saleId = crypto.randomUUID();
    await db.insert(sales).values({
      id: saleId, businessId, customerId: s.customerId, userId,
      reference: `S-${ref++}`, subtotal: total, discount: 0, tax: 0, total, costTotal,
      amountPaid: paid, balance, paymentMethod: "CASH",
      paymentStatus: balance <= 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID",
      status: "COMPLETED", createdAt,
      dueAt: s.dueInDays !== undefined ? new Date(createdAt.getTime() + s.dueInDays * day) : null,
    });
    // Keep stock roughly consistent with the opening quantities (tracked in memory).
    for (const it of s.items) {
      const next = Math.max(0, (stock.get(it.p.id) ?? 0) - it.qty);
      stock.set(it.p.id, next);
      await db.update(products).set({ quantity: next }).where(eq(products.id, it.p.id));
    }
  }

  // 6. Purchases — one received, one ordered with a balance (payable).
  await q.createPurchase(businessId, {
    userId, supplierId: sup.id, reference: "P-2001",
    items: [{ productId: p1.id, name: "Rice 50kg Bag", quantity: 20, unitCost: 4_500_000 }],
    amountPaid: 90_000_000, status: "RECEIVED",
  });
  await q.createPurchase(businessId, {
    userId, supplierId: sup.id, reference: "P-2002",
    items: [{ productId: p4.id, name: "Detergent 1kg", quantity: 100, unitCost: 250_000 }],
    amountPaid: 10_000_000, status: "ORDERED",
  });
  // Give the ordered purchase a due date in the past so it shows as overdue payable.
  await db.update(purchases).set({ dueAt: new Date(Date.now() - 6 * day) }).where(eq(purchases.reference, "P-2002"));

  // 7. Expenses — enough in one category to make an outlier detectable.
  const cats = ["Rent", "Transportation", "Staff salaries", "Marketing"];
  for (let i = 0; i < 6; i++) {
    await q.createExpense(businessId, { userId, description: `Transport run ${i + 1}`, amount: 45_000 + i * 3_000, paymentMethod: "CASH", expenseDate: new Date(Date.now() - (i + 1) * 2 * day) });
  }
  await q.createExpense(businessId, { userId, description: "Transport — emergency haulage", amount: 900_000, paymentMethod: "CASH", expenseDate: new Date(Date.now() - 3 * day) });
  await q.createExpense(businessId, { userId, description: "Shop rent — monthly", amount: 2_500_000, paymentMethod: "BANK_TRANSFER", expenseDate: new Date(Date.now() - 10 * day) });
  await q.createExpense(businessId, { userId, description: "Staff salaries", amount: 4_000_000, paymentMethod: "BANK_TRANSFER", expenseDate: new Date(Date.now() - 8 * day) });
  await q.createExpense(businessId, { userId, description: "Facebook ads", amount: 350_000, paymentMethod: "ONLINE", expenseDate: new Date(Date.now() - 5 * day) });

  console.log("SEED_OK", JSON.stringify({ email: EMAIL, password: PASSWORD, businessId }));
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED_FAILED", e);
  process.exit(1);
});
