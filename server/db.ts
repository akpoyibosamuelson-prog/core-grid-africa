// ── AGENT-OWNED: business data-access ────────────────────────────────────────
// All queries live here; routers stay thin. Every business-scoped query takes a
// businessId that the router resolved from the caller's membership — that is the
// isolation boundary. Money is integer kobo throughout.
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, sum } from "drizzle-orm";
import { hash as bcryptHash } from "bcryptjs";
import { atomic, db } from "./_core/db";
import {
  auditLogs, branches, businessMembers, businesses, categories, customers, deliveries,
  employees, expenses, invoices, notifications, orderItems, orders, payments, products,
  purchaseItems, purchases, saleItems, sales, stockMovements, subscriptions, suppliers,
  supportRequests, users, platformAdmins, platformSettings as platformSettingsTable,
  advisorConversations,
} from "../drizzle/schema";
import { planDurationMs, type MemberRole, type PlanBillingPeriod } from "../shared/constants";

// ── Membership / business context ────────────────────────────────────────────

export async function listMembershipsForUser(userId: string) {
  return db
    .select({
      businessId: businessMembers.businessId,
      role: businessMembers.role,
      status: businessMembers.status,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      plan: businesses.plan,
      currency: businesses.currency,
      currencySymbol: businesses.currencySymbol,
      logoUrl: businesses.logoUrl,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .where(and(eq(businessMembers.userId, userId), eq(businessMembers.status, "ACTIVE")))
    .orderBy(asc(businesses.createdAt));
}

export async function getMembership(userId: string, businessId: string) {
  const [row] = await db
    .select()
    .from(businessMembers)
    .where(
      and(
        eq(businessMembers.userId, userId),
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getBusiness(businessId: string) {
  const [row] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  return row ?? null;
}

export async function createBusinessWithOwner(input: {
  ownerId: string;
  name: string;
  slug: string;
  industry?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  currency?: string;
  currencySymbol?: string;
  taxRate?: number;
}) {
  const id = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const [biz] = await atomic((d) => [
    d
      .insert(businesses)
      .values({
        id,
        ownerId: input.ownerId,
        name: input.name,
        slug: input.slug,
        industry: input.industry ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        currency: input.currency ?? "NGN",
        currencySymbol: input.currencySymbol ?? "₦",
        taxRate: input.taxRate ?? 0,
      })
      .returning(),
    d.insert(businessMembers).values({ businessId: id, userId: input.ownerId, role: "OWNER" }).returning(),
    d.insert(branches).values({ id: branchId, businessId: id, name: "Main Branch", isDefault: true }).returning(),
    d.insert(subscriptions).values({ businessId: id, plan: "FREE", status: "ACTIVE" }).returning(),
  ]);
  return biz as unknown as { id: string; name: string };
}

export async function updateBusiness(
  businessId: string,
  patch: Partial<{
    name: string; industry: string; phone: string; email: string; address: string;
    city: string; state: string; currency: string; currencySymbol: string;
    taxRate: number; logoUrl: string; invoicePrefix: string; receiptFooter: string;
  }>,
) {
  const [row] = await db.update(businesses).set(patch).where(eq(businesses.id, businessId)).returning();
  return row;
}

// ── Branches ─────────────────────────────────────────────────────────────────
export async function listBranches(businessId: string) {
  return db.select().from(branches).where(eq(branches.businessId, businessId)).orderBy(desc(branches.isDefault), asc(branches.name));
}
export async function createBranch(businessId: string, input: { name: string; address?: string; phone?: string }) {
  const [row] = await db.insert(branches).values({ businessId, ...input }).returning();
  return row;
}
export async function deleteBranch(businessId: string, id: string) {
  await db.delete(branches).where(and(eq(branches.id, id), eq(branches.businessId, businessId)));
  return { ok: true };
}

// ── Categories ───────────────────────────────────────────────────────────────
export async function listCategories(businessId: string, kind?: string) {
  const where = kind
    ? and(eq(categories.businessId, businessId), eq(categories.kind, kind))
    : eq(categories.businessId, businessId);
  return db.select().from(categories).where(where).orderBy(asc(categories.name));
}
export async function createCategory(businessId: string, input: { name: string; kind?: string }) {
  const [row] = await db.insert(categories).values({ businessId, name: input.name, kind: input.kind ?? "PRODUCT" }).returning();
  return row;
}
export async function deleteCategory(businessId: string, id: string) {
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.businessId, businessId)));
  return { ok: true };
}

// ── Suppliers ────────────────────────────────────────────────────────────────
export async function listSuppliers(businessId: string, search?: string) {
  const where = search
    ? and(eq(suppliers.businessId, businessId), or(ilike(suppliers.name, `%${search}%`), ilike(suppliers.phone, `%${search}%`)))
    : eq(suppliers.businessId, businessId);
  const rows = await db.select().from(suppliers).where(where).orderBy(desc(suppliers.createdAt));
  if (rows.length === 0) return rows.map((r) => ({ ...r, totalPurchases: 0, outstanding: 0 }));
  const stats = await db
    .select({
      supplierId: purchases.supplierId,
      totalPurchases: sum(purchases.total).mapWith(Number),
      outstanding: sum(purchases.balance).mapWith(Number),
    })
    .from(purchases)
    .where(and(eq(purchases.businessId, businessId), inArray(purchases.supplierId, rows.map((r) => r.id))))
    .groupBy(purchases.supplierId);
  const map = new Map(stats.map((s) => [s.supplierId, s]));
  return rows.map((r) => ({
    ...r,
    totalPurchases: map.get(r.id)?.totalPurchases ?? 0,
    outstanding: map.get(r.id)?.outstanding ?? 0,
  }));
}
export async function createSupplier(businessId: string, input: { name: string; contactName?: string; phone?: string; email?: string; address?: string; notes?: string }) {
  const [row] = await db.insert(suppliers).values({ businessId, ...input }).returning();
  return row;
}
export async function updateSupplier(businessId: string, id: string, patch: Record<string, unknown>) {
  const [row] = await db.update(suppliers).set(patch).where(and(eq(suppliers.id, id), eq(suppliers.businessId, businessId))).returning();
  return row;
}
export async function deleteSupplier(businessId: string, id: string) {
  await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.businessId, businessId)));
  return { ok: true };
}

// ── Customers ────────────────────────────────────────────────────────────────
export async function listCustomers(businessId: string, search?: string) {
  const where = search
    ? and(eq(customers.businessId, businessId), or(ilike(customers.name, `%${search}%`), ilike(customers.phone, `%${search}%`), ilike(customers.email, `%${search}%`)))
    : eq(customers.businessId, businessId);
  return db.select().from(customers).where(where).orderBy(desc(customers.createdAt));
}
export async function createCustomer(businessId: string, input: { name: string; phone?: string; email?: string; address?: string; category?: string; notes?: string }) {
  const [row] = await db.insert(customers).values({ businessId, ...input }).returning();
  return row;
}
export async function updateCustomer(businessId: string, id: string, patch: Record<string, unknown>) {
  const [row] = await db.update(customers).set(patch).where(and(eq(customers.id, id), eq(customers.businessId, businessId))).returning();
  return row;
}
export async function deleteCustomer(businessId: string, id: string) {
  await db.delete(customers).where(and(eq(customers.id, id), eq(customers.businessId, businessId)));
  return { ok: true };
}

/** Customer with derived purchase stats + outstanding balance. */
export async function listCustomersWithStats(businessId: string, search?: string) {
  const rows = await listCustomers(businessId, search);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const stats = await db
    .select({
      customerId: sales.customerId,
      totalSpent: sum(sales.total).mapWith(Number),
      outstanding: sum(sales.balance).mapWith(Number),
      orderCount: count(sales.id).mapWith(Number),
      lastSale: sql<Date>`max(${sales.createdAt})`,
    })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), inArray(sales.customerId, ids), eq(sales.status, "COMPLETED")))
    .groupBy(sales.customerId);
  const map = new Map(stats.map((s) => [s.customerId, s]));
  return rows.map((r) => {
    const s = map.get(r.id);
    return {
      ...r,
      totalSpent: s?.totalSpent ?? 0,
      outstanding: s?.outstanding ?? 0,
      orderCount: s?.orderCount ?? 0,
      lastSale: s?.lastSale ?? null,
    };
  });
}

// ── Products / inventory ─────────────────────────────────────────────────────
export async function listProducts(businessId: string, opts: { search?: string; categoryId?: string; lowStockOnly?: boolean } = {}) {
  const conds = [eq(products.businessId, businessId)];
  if (opts.search) conds.push(or(ilike(products.name, `%${opts.search}%`), ilike(products.sku, `%${opts.search}%`), ilike(products.barcode, `%${opts.search}%`))!);
  if (opts.categoryId) conds.push(eq(products.categoryId, opts.categoryId));
  if (opts.lowStockOnly) conds.push(sql`${products.quantity} <= ${products.minStockLevel}`);
  return db
    .select({
      id: products.id, businessId: products.businessId, categoryId: products.categoryId, supplierId: products.supplierId,
      name: products.name, sku: products.sku, barcode: products.barcode, unit: products.unit,
      costPrice: products.costPrice, wholesalePrice: products.wholesalePrice, retailPrice: products.retailPrice,
      quantity: products.quantity, minStockLevel: products.minStockLevel,
      safetyStock: products.safetyStock, supplierLeadTimeDays: products.supplierLeadTimeDays, expiryDate: products.expiryDate,
      location: products.location,
      imageUrl: products.imageUrl, isActive: products.isActive, createdAt: products.createdAt,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conds))
    .orderBy(asc(products.name));
}

export async function getProduct(businessId: string, id: string) {
  const [row] = await db.select().from(products).where(and(eq(products.id, id), eq(products.businessId, businessId))).limit(1);
  return row ?? null;
}

export async function createProduct(businessId: string, input: {
  name: string; categoryId?: string; supplierId?: string; sku?: string; barcode?: string; unit?: string;
  costPrice?: number; wholesalePrice?: number; retailPrice?: number; quantity?: number; minStockLevel?: number;
  safetyStock?: number; supplierLeadTimeDays?: number; expiryDate?: Date;
  location?: string; imageUrl?: string;
}) {
  const id = crypto.randomUUID();
  const qty = input.quantity ?? 0;
  const [row] = await atomic((d) => [
    d.insert(products).values({
      id, businessId, name: input.name, categoryId: input.categoryId ?? null, supplierId: input.supplierId ?? null,
      sku: input.sku ?? null, barcode: input.barcode ?? null, unit: input.unit ?? "pcs",
      costPrice: input.costPrice ?? 0, wholesalePrice: input.wholesalePrice ?? 0, retailPrice: input.retailPrice ?? 0,
      quantity: qty, minStockLevel: input.minStockLevel ?? 0,
      safetyStock: input.safetyStock ?? 0, supplierLeadTimeDays: input.supplierLeadTimeDays ?? 7,
      expiryDate: input.expiryDate ?? null,
      location: input.location ?? null, imageUrl: input.imageUrl ?? null,
    }).returning(),
    ...(qty > 0
      ? [d.insert(stockMovements).values({ businessId, productId: id, type: "IN", quantity: qty, balanceAfter: qty, reason: "Opening stock" }).returning()]
      : []),
  ]);
  return row as unknown as { id: string; name: string };
}

export async function updateProduct(businessId: string, id: string, patch: Record<string, unknown>) {
  const [row] = await db.update(products).set(patch).where(and(eq(products.id, id), eq(products.businessId, businessId))).returning();
  return row;
}

export async function deleteProduct(businessId: string, id: string) {
  await db.delete(products).where(and(eq(products.id, id), eq(products.businessId, businessId)));
  return { ok: true };
}

/** Manual stock adjustment — records a movement and updates the balance atomically. */
export async function adjustStock(businessId: string, input: { productId: string; delta: number; reason: string; userId: string }) {
  const product = await getProduct(businessId, input.productId);
  if (!product) throw new Error("Product not found");
  const newQty = product.quantity + input.delta;
  if (newQty < 0) throw new Error("Adjustment would make stock negative");
  const [, updated] = await atomic((d) => [
    d.insert(stockMovements).values({
      businessId, productId: input.productId, type: "ADJUSTMENT", quantity: input.delta,
      balanceAfter: newQty, reason: input.reason, userId: input.userId,
    }).returning(),
    d.update(products).set({ quantity: newQty }).where(and(eq(products.id, input.productId), eq(products.businessId, businessId))).returning(),
  ]);
  return updated[0];
}

export async function listStockMovements(businessId: string, productId?: string) {
  const where = productId
    ? and(eq(stockMovements.businessId, businessId), eq(stockMovements.productId, productId))
    : eq(stockMovements.businessId, businessId);
  return db
    .select({
      id: stockMovements.id, type: stockMovements.type, quantity: stockMovements.quantity,
      quantityDelta: stockMovements.quantity,
      balanceAfter: stockMovements.balanceAfter, reason: stockMovements.reason, reference: stockMovements.reference,
      createdAt: stockMovements.createdAt, productName: products.name,
    })
    .from(stockMovements)
    .leftJoin(products, eq(products.id, stockMovements.productId))
    .where(where)
    .orderBy(desc(stockMovements.createdAt))
    .limit(200);
}

export async function inventorySummary(businessId: string) {
  const [row] = await db
    .select({
      totalProducts: count(products.id).mapWith(Number),
      totalUnits: sum(products.quantity).mapWith(Number),
      stockValue: sql<number>`coalesce(sum(${products.quantity} * ${products.costPrice}), 0)`.mapWith(Number),
      retailValue: sql<number>`coalesce(sum(${products.quantity} * ${products.retailPrice}), 0)`.mapWith(Number),
    })
    .from(products)
    .where(eq(products.businessId, businessId));
  const [low] = await db
    .select({ n: count(products.id).mapWith(Number) })
    .from(products)
    .where(and(eq(products.businessId, businessId), sql`${products.quantity} > 0 and ${products.quantity} <= ${products.minStockLevel}`));
  const [out] = await db
    .select({ n: count(products.id).mapWith(Number) })
    .from(products)
    .where(and(eq(products.businessId, businessId), lte(products.quantity, 0)));
  return {
    totalProducts: row?.totalProducts ?? 0,
    totalUnits: row?.totalUnits ?? 0,
    stockValue: row?.stockValue ?? 0,
    retailValue: row?.retailValue ?? 0,
    lowStock: low?.n ?? 0,
    outOfStock: out?.n ?? 0,
  };
}

// ── Sales ────────────────────────────────────────────────────────────────────
export type SaleLineInput = { productId?: string; name: string; quantity: number; unitPrice: number; costPrice?: number; discount?: number };

export async function createSale(businessId: string, input: {
  userId: string; branchId?: string; customerId?: string; reference: string;
  items: SaleLineInput[]; discount?: number; taxRate?: number; amountPaid: number;
  paymentMethod: string; notes?: string;
}) {
  const subtotal = input.items.reduce((s, it) => s + it.quantity * it.unitPrice - (it.discount ?? 0), 0);
  const discount = input.discount ?? 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round((taxable * (input.taxRate ?? 0)) / 10000);
  const total = taxable + tax;
  const costTotal = input.items.reduce((s, it) => s + it.quantity * (it.costPrice ?? 0), 0);
  const amountPaid = Math.min(input.amountPaid, total);
  const balance = total - amountPaid;
  const paymentStatus = balance <= 0 ? "PAID" : amountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";
  const saleId = crypto.randomUUID();

  // Validate stock for tracked products before writing anything.
  const tracked = input.items.filter((it) => it.productId);
  for (const it of tracked) {
    const p = await getProduct(businessId, it.productId!);
    if (!p) throw new Error(`Product not found: ${it.name}`);
    if (p.quantity < it.quantity) throw new Error(`Insufficient stock for ${p.name} (have ${p.quantity}, need ${it.quantity})`);
  }

  const results = await atomic((d) => {
    const list: unknown[] = [
      d.insert(sales).values({
        id: saleId, businessId, branchId: input.branchId ?? null, customerId: input.customerId ?? null,
        userId: input.userId, reference: input.reference, subtotal, discount, tax, total, costTotal,
        amountPaid, balance, paymentMethod: input.paymentMethod as never, paymentStatus: paymentStatus as never,
        status: "COMPLETED", notes: input.notes ?? null,
      }).returning(),
      ...input.items.map((it) =>
        d.insert(saleItems).values({
          saleId, productId: it.productId ?? null, name: it.name, quantity: it.quantity,
          unitPrice: it.unitPrice, costPrice: it.costPrice ?? 0, discount: it.discount ?? 0,
          lineTotal: it.quantity * it.unitPrice - (it.discount ?? 0),
        }).returning(),
      ),
      ...tracked.map((it) =>
        d.update(products).set({ quantity: sql`${products.quantity} - ${it.quantity}` })
          .where(and(eq(products.id, it.productId!), eq(products.businessId, businessId))).returning(),
      ),
      ...tracked.map((it) =>
        d.insert(stockMovements).values({
          businessId, productId: it.productId!, type: "OUT", quantity: -it.quantity,
          balanceAfter: 0, reason: "Sale", reference: input.reference, userId: input.userId,
        }).returning(),
      ),
      d.insert(payments).values({
        businessId, type: "SALE", reference: `${input.reference}-PAY`, saleId, amount: amountPaid,
        method: input.paymentMethod as never, status: amountPaid > 0 ? "SUCCESS" : "PENDING", provider: "manual",
        verifiedAt: amountPaid > 0 ? new Date() : null,
      }).returning(),
      d.insert(invoices).values({ businessId, saleId, number: input.reference, status: paymentStatus as never }).returning(),
      d.insert(auditLogs).values({ businessId, userId: input.userId, action: "SALE_CREATED", entity: "sale", entityId: saleId, meta: JSON.stringify({ total }) }).returning(),
    ];
    return list as unknown as [never, ...never[]];
  });
  void 0;
  const sale = (results[0] as unknown as { id: string }[])[0];
  return { ...sale, reference: input.reference, subtotal, discount, tax, total, costTotal, amountPaid, balance, paymentStatus };
}

export async function listSales(businessId: string, opts: { from?: Date; to?: Date; search?: string; limit?: number } = {}) {
  const conds = [eq(sales.businessId, businessId)];
  if (opts.from) conds.push(gte(sales.createdAt, opts.from));
  if (opts.to) conds.push(lte(sales.createdAt, opts.to));
  if (opts.search) conds.push(ilike(sales.reference, `%${opts.search}%`));
  const rows = await db
    .select({
      id: sales.id, reference: sales.reference, total: sales.total, amountPaid: sales.amountPaid,
      balance: sales.balance, paymentMethod: sales.paymentMethod, paymentStatus: sales.paymentStatus,
      status: sales.status, createdAt: sales.createdAt, customerName: customers.name, customerId: sales.customerId,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(and(...conds))
    .orderBy(desc(sales.createdAt))
    .limit(opts.limit ?? 200);
  if (rows.length === 0) return rows.map((r) => ({ ...r, itemCount: 0 }));
  const counts = await db
    .select({ saleId: saleItems.saleId, n: count(saleItems.id).mapWith(Number) })
    .from(saleItems)
    .where(inArray(saleItems.saleId, rows.map((r) => r.id)))
    .groupBy(saleItems.saleId);
  const map = new Map(counts.map((c) => [c.saleId, c.n]));
  return rows.map((r) => ({ ...r, itemCount: map.get(r.id) ?? 0 }));
}

export async function getSale(businessId: string, id: string) {
  const [sale] = await db.select().from(sales).where(and(eq(sales.id, id), eq(sales.businessId, businessId))).limit(1);
  if (!sale) return null;
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id));
  const [customer] = sale.customerId
    ? await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1)
    : [null];
  return { ...sale, items, customer, customerName: customer?.name ?? null };
}

/** Cancel a sale: restore stock, mark cancelled, log it. */
export async function cancelSale(businessId: string, id: string, userId: string, reason: string) {
  const sale = await getSale(businessId, id);
  if (!sale) throw new Error("Sale not found");
  if (sale.status !== "COMPLETED") throw new Error("Only completed sales can be cancelled");
  const items = sale.items.filter((it) => it.productId);
  await atomic((d) => {
    const list: unknown[] = [
      d.update(sales).set({ status: "CANCELLED" }).where(and(eq(sales.id, id), eq(sales.businessId, businessId))).returning(),
      ...items.map((it) =>
        d.update(products).set({ quantity: sql`${products.quantity} + ${it.quantity}` })
          .where(and(eq(products.id, it.productId!), eq(products.businessId, businessId))).returning(),
      ),
      ...items.map((it) =>
        d.insert(stockMovements).values({
          businessId, productId: it.productId!, type: "IN", quantity: it.quantity,
          balanceAfter: 0, reason: `Sale cancelled: ${reason}`, reference: sale.reference, userId,
        }).returning(),
      ),
      d.insert(auditLogs).values({ businessId, userId, action: "SALE_CANCELLED", entity: "sale", entityId: id, meta: JSON.stringify({ reason }) }).returning(),
    ];
    return list as unknown as [never, ...never[]];
  });
  return { ok: true };
}

// ── Purchases ────────────────────────────────────────────────────────────────
export async function createPurchase(businessId: string, input: {
  userId: string; supplierId?: string; branchId?: string; reference: string;
  items: { productId?: string; name: string; quantity: number; unitCost: number }[];
  amountPaid: number; status: string; notes?: string;
}) {
  const subtotal = input.items.reduce((s, it) => s + it.quantity * it.unitCost, 0);
  const total = subtotal;
  const amountPaid = Math.min(input.amountPaid, total);
  const balance = total - amountPaid;
  const purchaseId = crypto.randomUUID();
  const received = input.status === "RECEIVED";
  const tracked = input.items.filter((it) => it.productId);

  await atomic((d) => {
    const list: unknown[] = [
      d.insert(purchases).values({
        id: purchaseId, businessId, supplierId: input.supplierId ?? null, branchId: input.branchId ?? null,
        userId: input.userId, reference: input.reference, subtotal, total, amountPaid, balance,
        status: input.status as never, notes: input.notes ?? null,
      }).returning(),
      ...input.items.map((it) =>
        d.insert(purchaseItems).values({
          purchaseId, productId: it.productId ?? null, name: it.name, quantity: it.quantity,
          unitCost: it.unitCost, lineTotal: it.quantity * it.unitCost,
        }).returning(),
      ),
      ...(received
        ? tracked.flatMap((it) => [
            d.update(products).set({ quantity: sql`${products.quantity} + ${it.quantity}`, costPrice: it.unitCost })
              .where(and(eq(products.id, it.productId!), eq(products.businessId, businessId))).returning(),
            d.insert(stockMovements).values({
              businessId, productId: it.productId!, type: "IN", quantity: it.quantity,
              balanceAfter: 0, reason: "Purchase received", reference: input.reference, userId: input.userId,
            }).returning(),
          ])
        : []),
      ...(amountPaid > 0
        ? [d.insert(payments).values({
            businessId, type: "PURCHASE", reference: `${input.reference}-PAY`, purchaseId, amount: amountPaid,
            method: "CASH", status: "SUCCESS", provider: "manual", verifiedAt: new Date(),
          }).returning()]
        : []),
      d.insert(auditLogs).values({ businessId, userId: input.userId, action: "PURCHASE_CREATED", entity: "purchase", entityId: purchaseId, meta: JSON.stringify({ total, status: input.status }) }).returning(),
    ];
    return list as unknown as [never, ...never[]];
  });
  return { id: purchaseId, subtotal, total, amountPaid, balance };
}

export async function listPurchases(businessId: string, opts: { from?: Date; to?: Date } = {}) {
  const conds = [eq(purchases.businessId, businessId)];
  if (opts.from) conds.push(gte(purchases.createdAt, opts.from));
  if (opts.to) conds.push(lte(purchases.createdAt, opts.to));
  return db
    .select({
      id: purchases.id, reference: purchases.reference, total: purchases.total, amountPaid: purchases.amountPaid,
      balance: purchases.balance, status: purchases.status, createdAt: purchases.createdAt, supplierName: suppliers.name,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .where(and(...conds))
    .orderBy(desc(purchases.createdAt))
    .limit(200);
}

export async function getPurchase(businessId: string, id: string) {
  const [p] = await db.select().from(purchases).where(and(eq(purchases.id, id), eq(purchases.businessId, businessId))).limit(1);
  if (!p) return null;
  const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
  const [sup] = p.supplierId
    ? await db.select().from(suppliers).where(eq(suppliers.id, p.supplierId)).limit(1)
    : [null];
  return { ...p, items, supplierName: sup?.name ?? null };
}

/** Mark a purchase received — increases stock for its items (once). */
export async function receivePurchase(businessId: string, id: string, userId: string) {
  const p = await getPurchase(businessId, id);
  if (!p) throw new Error("Purchase not found");
  if (p.status === "RECEIVED") throw new Error("Purchase already received");
  const tracked = p.items.filter((it) => it.productId);
  await atomic((d) => {
    const list: unknown[] = [
      d.update(purchases).set({ status: "RECEIVED" }).where(and(eq(purchases.id, id), eq(purchases.businessId, businessId))).returning(),
      ...tracked.flatMap((it) => [
        d.update(products).set({ quantity: sql`${products.quantity} + ${it.quantity}`, costPrice: it.unitCost })
          .where(and(eq(products.id, it.productId!), eq(products.businessId, businessId))).returning(),
        d.insert(stockMovements).values({
          businessId, productId: it.productId!, type: "IN", quantity: it.quantity,
          balanceAfter: 0, reason: "Purchase received", reference: p.reference, userId,
        }).returning(),
      ]),
      d.insert(auditLogs).values({ businessId, userId, action: "PURCHASE_RECEIVED", entity: "purchase", entityId: id }).returning(),
    ];
    return list as unknown as [never, ...never[]];
  });
  return { ok: true };
}

// ── Expenses ─────────────────────────────────────────────────────────────────
export async function listExpenses(businessId: string, opts: { from?: Date; to?: Date; search?: string; categoryId?: string } = {}) {
  const conds = [eq(expenses.businessId, businessId)];
  if (opts.from) conds.push(gte(expenses.expenseDate, opts.from));
  if (opts.to) conds.push(lte(expenses.expenseDate, opts.to));
  if (opts.search) conds.push(ilike(expenses.description, `%${opts.search}%`));
  if (opts.categoryId) conds.push(eq(expenses.categoryId, opts.categoryId));
  return db
    .select({
      id: expenses.id, description: expenses.description, amount: expenses.amount, paymentMethod: expenses.paymentMethod,
      expenseDate: expenses.expenseDate, receiptUrl: expenses.receiptUrl, isRecurring: expenses.isRecurring,
      recurrence: expenses.recurrence, categoryName: categories.name, categoryId: expenses.categoryId,
    })
    .from(expenses)
    .leftJoin(categories, eq(categories.id, expenses.categoryId))
    .where(and(...conds))
    .orderBy(desc(expenses.expenseDate))
    .limit(300);
}

export async function createExpense(businessId: string, input: {
  userId: string; branchId?: string; categoryId?: string; description: string; amount: number;
  paymentMethod: string; expenseDate?: Date; receiptUrl?: string; isRecurring?: boolean; recurrence?: string;
}) {
  const [row] = await db.insert(expenses).values({
    businessId, branchId: input.branchId ?? null, categoryId: input.categoryId ?? null, userId: input.userId,
    description: input.description, amount: input.amount, paymentMethod: input.paymentMethod as never,
    expenseDate: input.expenseDate ?? new Date(), receiptUrl: input.receiptUrl ?? null,
    isRecurring: input.isRecurring ?? false, recurrence: input.recurrence ?? null,
  }).returning();
  return row;
}

export async function updateExpense(businessId: string, id: string, patch: Record<string, unknown>) {
  const [row] = await db.update(expenses).set(patch).where(and(eq(expenses.id, id), eq(expenses.businessId, businessId))).returning();
  return row;
}

export async function deleteExpense(businessId: string, id: string) {
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.businessId, businessId)));
  return { ok: true };
}

// ── Orders & deliveries ──────────────────────────────────────────────────────
export async function listOrders(businessId: string, opts: { status?: string; search?: string } = {}) {
  const conds = [eq(orders.businessId, businessId)];
  if (opts.status) conds.push(eq(orders.status, opts.status as never));
  if (opts.search) conds.push(ilike(orders.reference, `%${opts.search}%`));
  return db
    .select({
      id: orders.id, reference: orders.reference, total: orders.total, amountPaid: orders.amountPaid,
      paymentStatus: orders.paymentStatus, status: orders.status, deliveryAddress: orders.deliveryAddress,
      createdAt: orders.createdAt, customerName: customers.name, customerId: orders.customerId,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(...conds))
    .orderBy(desc(orders.createdAt))
    .limit(200);
}

export async function getOrder(businessId: string, id: string) {
  const [o] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.businessId, businessId))).limit(1);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const dels = await db.select().from(deliveries).where(eq(deliveries.orderId, id));
  const [customer] = o.customerId
    ? await db.select().from(customers).where(eq(customers.id, o.customerId)).limit(1)
    : [null];
  return { ...o, items, deliveries: dels, customerName: customer?.name ?? null };
}

export async function createOrder(businessId: string, input: {
  userId: string; customerId?: string; reference: string;
  items: { productId?: string; name: string; quantity: number; unitPrice: number }[];
  deliveryAddress?: string; notes?: string; amountPaid?: number;
}) {
  const total = input.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const amountPaid = Math.min(input.amountPaid ?? 0, total);
  const paymentStatus = amountPaid >= total && total > 0 ? "PAID" : amountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";
  const orderId = crypto.randomUUID();
  await atomic((d) => {
    const list: unknown[] = [
      d.insert(orders).values({
        id: orderId, businessId, customerId: input.customerId ?? null, userId: input.userId,
        reference: input.reference, total, amountPaid, paymentStatus: paymentStatus as never,
        status: "PENDING", deliveryAddress: input.deliveryAddress ?? null, notes: input.notes ?? null,
      }).returning(),
      ...input.items.map((it) =>
        d.insert(orderItems).values({
          orderId, productId: it.productId ?? null, name: it.name, quantity: it.quantity,
          unitPrice: it.unitPrice, lineTotal: it.quantity * it.unitPrice,
        }).returning(),
      ),
      d.insert(auditLogs).values({ businessId, userId: input.userId, action: "ORDER_CREATED", entity: "order", entityId: orderId, meta: JSON.stringify({ total }) }).returning(),
    ];
    return list as unknown as [never, ...never[]];
  });
  return { id: orderId, total, amountPaid, paymentStatus };
}

export async function updateOrderStatus(businessId: string, id: string, status: string, userId: string) {
  const [row] = await db.update(orders).set({ status: status as never }).where(and(eq(orders.id, id), eq(orders.businessId, businessId))).returning();
  await db.insert(auditLogs).values({ businessId, userId, action: "ORDER_STATUS", entity: "order", entityId: id, meta: JSON.stringify({ status }) });
  return row;
}

export async function createDelivery(businessId: string, input: { orderId: string; courier?: string; trackingNumber?: string; notes?: string }) {
  const [row] = await db.insert(deliveries).values({ businessId, ...input }).returning();
  return row;
}

export async function updateDelivery(businessId: string, id: string, patch: { status?: string; courier?: string; trackingNumber?: string; notes?: string }) {
  const set: Record<string, unknown> = { ...patch };
  if (patch.status === "DELIVERED") set.deliveredAt = new Date();
  const [row] = await db.update(deliveries).set(set).where(and(eq(deliveries.id, id), eq(deliveries.businessId, businessId))).returning();
  return row;
}

// ── Employees ────────────────────────────────────────────────────────────────
export async function listEmployees(businessId: string) {
  return db.select().from(employees).where(eq(employees.businessId, businessId)).orderBy(desc(employees.createdAt));
}
export async function createEmployee(businessId: string, input: { name: string; email?: string; phone?: string; role: string; department?: string; hiredAt?: Date }) {
  const [row] = await db.insert(employees).values({
    businessId, name: input.name, email: input.email ?? null, phone: input.phone ?? null,
    role: input.role as never, department: input.department ?? null, hiredAt: input.hiredAt ?? null,
  }).returning();
  return row;
}
export async function updateEmployee(businessId: string, id: string, patch: Record<string, unknown>) {
  const [row] = await db.update(employees).set(patch).where(and(eq(employees.id, id), eq(employees.businessId, businessId))).returning();
  return row;
}
export async function deleteEmployee(businessId: string, id: string) {
  await db.delete(employees).where(and(eq(employees.id, id), eq(employees.businessId, businessId)));
  return { ok: true };
}

export async function listMembers(businessId: string) {
  return db
    .select({
      id: businessMembers.id, userId: businessMembers.userId, role: businessMembers.role,
      status: businessMembers.status, createdAt: businessMembers.createdAt,
      name: users.name, email: users.email,
    })
    .from(businessMembers)
    .innerJoin(users, eq(users.id, businessMembers.userId))
    .where(eq(businessMembers.businessId, businessId))
    .orderBy(asc(businessMembers.createdAt));
}

export async function updateMemberRole(businessId: string, memberId: string, role: string) {
  const [row] = await db.update(businessMembers).set({ role: role as never }).where(and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, businessId))).returning();
  return row;
}

export async function removeMember(businessId: string, memberId: string) {
  await db.delete(businessMembers).where(and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, businessId)));
  return { ok: true };
}

// ── Notifications ────────────────────────────────────────────────────────────
export async function listNotifications(businessId: string, userId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.businessId, businessId), or(eq(notifications.userId, userId), sql`${notifications.userId} is null`)))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}
export async function unreadNotificationCount(businessId: string, userId: string) {
  const [row] = await db
    .select({ n: count(notifications.id).mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.businessId, businessId), eq(notifications.isRead, false), or(eq(notifications.userId, userId), sql`${notifications.userId} is null`)));
  return row?.n ?? 0;
}
export async function markNotificationRead(businessId: string, userId: string, id: string) {
  void userId;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.businessId, businessId)));
  return { ok: true };
}
export async function markAllNotificationsRead(businessId: string, userId: string) {
  void userId;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.businessId, businessId), eq(notifications.isRead, false)));
  return { ok: true };
}
export async function createNotification(businessId: string, input: { userId?: string; type: string; title: string; message?: string; link?: string }) {
  const [row] = await db.insert(notifications).values({
    businessId, userId: input.userId ?? null, type: input.type as never, title: input.title,
    message: input.message ?? null, link: input.link ?? null,
  }).returning();
  return row;
}

/** True when an UNREAD notification of this type already exists since `since`.
 *  The daily alert sweep uses it so a repeated run never spams the same warning. */
export async function hasUnreadNotificationSince(businessId: string, type: string, since: Date) {
  const [row] = await db
    .select({ n: count(notifications.id).mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.businessId, businessId), eq(notifications.type, type as never), eq(notifications.isRead, false), gte(notifications.createdAt, since)));
  return (row?.n ?? 0) > 0;
}

// ── Dashboard / analytics ────────────────────────────────────────────────────
export async function dashboardStats(businessId: string, from: Date, to: Date) {
  const [salesAgg] = await db
    .select({
      revenue: sum(sales.total).mapWith(Number),
      cogs: sum(sales.costTotal).mapWith(Number),
      collected: sum(sales.amountPaid).mapWith(Number),
      outstanding: sum(sales.balance).mapWith(Number),
      count: count(sales.id).mapWith(Number),
    })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED"), gte(sales.createdAt, from), lte(sales.createdAt, to)));

  const [expAgg] = await db
    .select({ total: sum(expenses.amount).mapWith(Number), count: count(expenses.id).mapWith(Number) })
    .from(expenses)
    .where(and(eq(expenses.businessId, businessId), gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)));

  const [custAgg] = await db
    .select({ n: count(customers.id).mapWith(Number) })
    .from(customers)
    .where(and(eq(customers.businessId, businessId), gte(customers.createdAt, from), lte(customers.createdAt, to)));

  const revenue = salesAgg?.revenue ?? 0;
  const cogs = salesAgg?.cogs ?? 0;
  const grossProfit = revenue - cogs;
  const expenseTotal = expAgg?.total ?? 0;
  const netProfit = grossProfit - expenseTotal;

  const inv = await inventorySummary(businessId);

  return {
    revenue, cogs, grossProfit, expenseTotal, netProfit,
    collected: salesAgg?.collected ?? 0,
    outstanding: salesAgg?.outstanding ?? 0,
    salesCount: salesAgg?.count ?? 0,
    expenseCount: expAgg?.count ?? 0,
    newCustomers: custAgg?.n ?? 0,
    inventory: inv,
  };
}

/** Daily revenue + expense series for charts. */
export async function salesTrend(businessId: string, from: Date, to: Date) {
  const rows = await db
    .select({
      day: sql<string>`to_char(${sales.createdAt}, 'YYYY-MM-DD')`,
      revenue: sum(sales.total).mapWith(Number),
      profit: sql<number>`coalesce(sum(${sales.total} - ${sales.costTotal}), 0)`.mapWith(Number),
      count: count(sales.id).mapWith(Number),
    })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED"), gte(sales.createdAt, from), lte(sales.createdAt, to)))
    .groupBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${sales.createdAt}, 'YYYY-MM-DD')`);
  return rows;
}

export async function topProducts(businessId: string, from: Date, to: Date, limit = 5) {
  return db
    .select({
      name: saleItems.name,
      qty: sum(saleItems.quantity).mapWith(Number),
      revenue: sum(saleItems.lineTotal).mapWith(Number),
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED"), gte(sales.createdAt, from), lte(sales.createdAt, to)))
    .groupBy(saleItems.name)
    .orderBy(desc(sum(saleItems.lineTotal)))
    .limit(limit);
}

export async function expenseByCategory(businessId: string, from: Date, to: Date) {
  return db
    .select({
      name: sql<string>`coalesce(${categories.name}, 'Uncategorised')`,
      total: sum(expenses.amount).mapWith(Number),
    })
    .from(expenses)
    .leftJoin(categories, eq(categories.id, expenses.categoryId))
    .where(and(eq(expenses.businessId, businessId), gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)))
    .groupBy(sql`coalesce(${categories.name}, 'Uncategorised')`)
    .orderBy(desc(sum(expenses.amount)));
}

export async function receivablesPayables(businessId: string) {
  const [rec] = await db
    .select({ total: sum(sales.balance).mapWith(Number) })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED")));
  const [pay] = await db
    .select({ total: sum(purchases.balance).mapWith(Number) })
    .from(purchases)
    .where(and(eq(purchases.businessId, businessId), inArray(purchases.status, ["ORDERED", "RECEIVED"])));
  return { receivables: rec?.total ?? 0, payables: pay?.total ?? 0 };
}

// ── Debt settlement (partial & full payments) ────────────────────────────────
// Recording a payment against a sale or purchase updates the balance, the
// payment status and the invoice in ONE atomic unit, and writes a payment row
// so the ledger and the cash-flow report both see it. The amount is clamped to
// the outstanding balance, so a payment can never over-settle a debt.

export async function recordSalePayment(
  businessId: string,
  saleId: string,
  input: { amount: number; method: string; userId: string },
) {
  const sale = await getSale(businessId, saleId);
  if (!sale) throw new Error("Sale not found");
  if (sale.status !== "COMPLETED") throw new Error("Only completed sales can be paid");
  const amount = Math.min(input.amount, sale.balance);
  if (amount <= 0) throw new Error("This sale has nothing outstanding");
  const newPaid = sale.amountPaid + amount;
  const newBalance = sale.total - newPaid;
  const status = newBalance <= 0 ? "PAID" : "PARTIALLY_PAID";
  await atomic((d) => {
    const list: unknown[] = [
      d.update(sales).set({ amountPaid: newPaid, balance: newBalance, paymentStatus: status as never })
        .where(and(eq(sales.id, saleId), eq(sales.businessId, businessId))).returning(),
      d.insert(payments).values({
        businessId, type: "SALE", reference: `${sale.reference}-PAY-${Date.now()}`, saleId, amount,
        method: input.method as never, status: "SUCCESS", provider: "manual", verifiedAt: new Date(),
      }).returning(),
      d.update(invoices).set({ status: status as never })
        .where(and(eq(invoices.saleId, saleId), eq(invoices.businessId, businessId))).returning(),
      d.insert(auditLogs).values({
        businessId, userId: input.userId, action: "SALE_PAYMENT", entity: "sale", entityId: saleId,
        meta: JSON.stringify({ amount, balance: newBalance }),
      }).returning(),
    ];
    return list as unknown as [never, ...never[]];
  });
  return { ok: true, amountPaid: newPaid, balance: newBalance, paymentStatus: status };
}

export async function recordPurchasePayment(
  businessId: string,
  purchaseId: string,
  input: { amount: number; method: string; userId: string },
) {
  const p = await getPurchase(businessId, purchaseId);
  if (!p) throw new Error("Purchase not found");
  const amount = Math.min(input.amount, p.balance);
  if (amount <= 0) throw new Error("This purchase has nothing outstanding");
  const newPaid = p.amountPaid + amount;
  const newBalance = p.total - newPaid;
  await atomic((d) => {
    const list: unknown[] = [
      d.update(purchases).set({ amountPaid: newPaid, balance: newBalance })
        .where(and(eq(purchases.id, purchaseId), eq(purchases.businessId, businessId))).returning(),
      d.insert(payments).values({
        businessId, type: "PURCHASE", reference: `${p.reference}-PAY-${Date.now()}`, purchaseId, amount,
        method: input.method as never, status: "SUCCESS", provider: "manual", verifiedAt: new Date(),
      }).returning(),
      d.insert(auditLogs).values({
        businessId, userId: input.userId, action: "PURCHASE_PAYMENT", entity: "purchase", entityId: purchaseId,
        meta: JSON.stringify({ amount, balance: newBalance }),
      }).returning(),
    ];
    return list as unknown as [never, ...never[]];
  });
  return { ok: true, amountPaid: newPaid, balance: newBalance };
}

// ── AI Business Advisor history ──────────────────────────────────────────────

export async function createAdvisorConversation(
  businessId: string,
  input: { userId?: string; question: string; answer: string; topic?: string; evidence?: unknown; source?: string },
) {
  const [row] = await db.insert(advisorConversations).values({
    businessId, userId: input.userId ?? null, question: input.question, answer: input.answer,
    topic: input.topic ?? null, evidence: input.evidence ? JSON.stringify(input.evidence) : null,
    source: input.source ?? "rules",
  }).returning();
  return row;
}

export async function listAdvisorConversations(businessId: string, limit = 50) {
  return db
    .select()
    .from(advisorConversations)
    .where(eq(advisorConversations.businessId, businessId))
    .orderBy(desc(advisorConversations.createdAt))
    .limit(limit);
}

export async function listPayments(businessId: string, limit = 100) {
  return db.select().from(payments).where(eq(payments.businessId, businessId)).orderBy(desc(payments.createdAt)).limit(limit);
}

export async function listAuditLogs(businessId: string, limit = 100) {
  return db
    .select({
      id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, entityId: auditLogs.entityId,
      meta: auditLogs.meta, createdAt: auditLogs.createdAt, userName: users.name, userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(eq(auditLogs.businessId, businessId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function logAudit(businessId: string, userId: string, action: string, entity?: string, entityId?: string, meta?: unknown) {
  await db.insert(auditLogs).values({
    businessId, userId, action, entity: entity ?? null, entityId: entityId ?? null,
    meta: meta ? JSON.stringify(meta) : null,
  });
}

// ── Subscriptions ────────────────────────────────────────────────────────────
export async function getSubscription(businessId: string) {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.businessId, businessId)).orderBy(desc(subscriptions.createdAt)).limit(1);
  return row ?? null;
}
export async function setSubscription(businessId: string, input: { plan: string; billingPeriod: string; amount: number; status?: string; providerRef?: string }) {
  const [row] = await db.insert(subscriptions).values({
    businessId, plan: input.plan as never, billingPeriod: input.billingPeriod as never,
    amount: input.amount, status: (input.status ?? "ACTIVE") as never, providerRef: input.providerRef ?? null,
  }).returning();
  await db.update(businesses).set({ plan: input.plan as never }).where(eq(businesses.id, businessId));
  return row;
}

// ── Support ──────────────────────────────────────────────────────────────────
export async function createSupportRequest(input: { businessId?: string; userId?: string; name?: string; email?: string; subject: string; message: string }) {
  const [row] = await db.insert(supportRequests).values({
    businessId: input.businessId ?? null, userId: input.userId ?? null, name: input.name ?? null,
    email: input.email ?? null, subject: input.subject, message: input.message,
  }).returning();
  return row;
}
export async function listSupportRequests() {
  return db.select().from(supportRequests).orderBy(desc(supportRequests.createdAt)).limit(200);
}
export async function updateSupportStatus(id: string, status: string) {
  const [row] = await db.update(supportRequests).set({ status }).where(eq(supportRequests.id, id)).returning();
  return row;
}

// ── Platform admin ───────────────────────────────────────────────────────────
export async function platformStats() {
  const [biz] = await db.select({ n: count(businesses.id).mapWith(Number) }).from(businesses);
  const [active] = await db.select({ n: count(businesses.id).mapWith(Number) }).from(businesses).where(eq(businesses.status, "ACTIVE"));
  const [suspended] = await db.select({ n: count(businesses.id).mapWith(Number) }).from(businesses).where(eq(businesses.status, "SUSPENDED"));
  const [usr] = await db.select({ n: count(users.id).mapWith(Number) }).from(users);
  const [subs] = await db.select({ n: count(subscriptions.id).mapWith(Number) }).from(subscriptions).where(eq(subscriptions.status, "ACTIVE"));
  const [rev] = await db.select({ total: sum(payments.amount).mapWith(Number) }).from(payments).where(and(eq(payments.type, "SUBSCRIPTION"), eq(payments.status, "SUCCESS")));
  const [openSupport] = await db.select({ n: count(supportRequests.id).mapWith(Number) }).from(supportRequests).where(eq(supportRequests.status, "OPEN"));
  return {
    businesses: biz?.n ?? 0, activeBusinesses: active?.n ?? 0, suspendedBusinesses: suspended?.n ?? 0,
    users: usr?.n ?? 0, activeSubscriptions: subs?.n ?? 0, platformRevenue: rev?.total ?? 0,
    openSupport: openSupport?.n ?? 0,
  };
}

export async function listAllBusinesses() {
  return db
    .select({
      id: businesses.id, name: businesses.name, slug: businesses.slug, plan: businesses.plan,
      status: businesses.status, createdAt: businesses.createdAt, ownerEmail: users.email, ownerName: users.name,
    })
    .from(businesses)
    .leftJoin(users, eq(users.id, businesses.ownerId))
    .orderBy(desc(businesses.createdAt))
    .limit(300);
}

export async function setBusinessStatus(businessId: string, status: string) {
  const [row] = await db.update(businesses).set({ status: status as never }).where(eq(businesses.id, businessId)).returning();
  return row;
}

export async function listAllUsers() {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(300);
}

export async function listAllSubscriptions() {
  return db
    .select({
      id: subscriptions.id, plan: subscriptions.plan, status: subscriptions.status,
      billingPeriod: subscriptions.billingPeriod, amount: subscriptions.amount, startedAt: subscriptions.startedAt,
      expiresAt: subscriptions.expiresAt, businessName: businesses.name,
    })
    .from(subscriptions)
    .leftJoin(businesses, eq(businesses.id, subscriptions.businessId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(300);
}

export async function listAllPayments() {
  return db
    .select({
      id: payments.id, type: payments.type, reference: payments.reference, amount: payments.amount,
      method: payments.method, status: payments.status, provider: payments.provider, createdAt: payments.createdAt,
      businessName: businesses.name,
    })
    .from(payments)
    .leftJoin(businesses, eq(businesses.id, payments.businessId))
    .orderBy(desc(payments.createdAt))
    .limit(300);
}

export async function listAllAuditLogs() {
  return db
    .select({
      id: auditLogs.id, action: auditLogs.action, entity: auditLogs.entity, createdAt: auditLogs.createdAt,
      businessName: businesses.name, userEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(businesses, eq(businesses.id, auditLogs.businessId))
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(300);
}

export async function getPlatformSettings() {
  const rows = await db.select().from(platformSettingsTable);
  return rows;
}

export async function setPlatformSetting(key: string, value: string) {
  const [row] = await db
    .insert(platformSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } })
    .returning();
  return row;
}

// ── Payment records (Paystack) ───────────────────────────────────────────────
export async function createPaymentRecord(input: {
  businessId: string; type: string; reference: string; amount: number; method: string;
  status: string; provider: string; providerRef?: string; saleId?: string;
  plan?: string; billingPeriod?: PlanBillingPeriod;
}) {
  const [row] = await db.insert(payments).values({
    businessId: input.businessId, type: input.type as never, reference: input.reference, amount: input.amount,
    method: input.method as never, status: input.status as never, provider: input.provider,
    providerRef: input.providerRef ?? null, saleId: input.saleId ?? null,
    plan: input.plan ?? null, billingPeriod: (input.billingPeriod ?? null) as never,
  }).returning();
  return row;
}

export async function getPaymentByReference(reference: string) {
  const [row] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1);
  return row ?? null;
}

export async function getPaymentById(businessId: string, id: string) {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.businessId, businessId)))
    .limit(1);
  return row ?? null;
}

/**
 * PENDING → SUCCESS, once. Returns the updated row, or null when the reference
 * was already settled (or does not exist). The caller treats null as "already
 * handled" — never as an error to retry. This guarded transition is what makes
 * duplicate payment impossible: two concurrent verifications of the same
 * reference cannot both update a PENDING row.
 */
export async function markPaymentVerified(reference: string, providerRef: string, meta?: unknown) {
  const [row] = await db
    .update(payments)
    .set({
      status: "SUCCESS",
      providerRef,
      verifiedAt: new Date(),
      failureReason: null,
      providerMeta: meta ? JSON.stringify(meta) : null,
    })
    .where(and(eq(payments.reference, reference), eq(payments.status, "PENDING")))
    .returning();
  return row ?? null;
}

/** PENDING → FAILED. Guarded the same way, so a settled payment is never
 *  downgraded by a late failure webhook. */
export async function markPaymentFailed(reference: string, reason?: string, meta?: unknown) {
  const [row] = await db
    .update(payments)
    .set({
      status: "FAILED",
      failureReason: reason ?? null,
      providerMeta: meta ? JSON.stringify(meta) : null,
    })
    .where(and(eq(payments.reference, reference), eq(payments.status, "PENDING")))
    .returning();
  return row ?? null;
}

/** PENDING → ABANDONED (customer left checkout without paying). */
export async function markPaymentAbandoned(reference: string, reason?: string) {
  const [row] = await db
    .update(payments)
    .set({ status: "ABANDONED", failureReason: reason ?? null })
    .where(and(eq(payments.reference, reference), eq(payments.status, "PENDING")))
    .returning();
  return row ?? null;
}

/** Business-scoped payment history, newest first, optionally filtered. */
export async function listPaymentsDetailed(
  businessId: string,
  opts: { status?: string; type?: string; limit?: number } = {},
) {
  const conds = [eq(payments.businessId, businessId)];
  if (opts.status) conds.push(eq(payments.status, opts.status as never));
  if (opts.type) conds.push(eq(payments.type, opts.type as never));
  return db
    .select()
    .from(payments)
    .where(and(...conds))
    .orderBy(desc(payments.createdAt))
    .limit(opts.limit ?? 100);
}

/** Provider transactions still PENDING — the reconciliation job's work list. */
export async function listPendingProviderPayments(olderThanMs = 0) {
  const cutoff = new Date(Date.now() - olderThanMs);
  return db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, "PENDING"),
        sql`${payments.provider} is not null`,
        lte(payments.createdAt, cutoff),
      ),
    )
    .orderBy(asc(payments.createdAt))
    .limit(100);
}

/**
 * Activate a paid subscription: record it and move the business onto the plan,
 * in ONE atomic unit. Called only after a provider verification has succeeded
 * AND the settled amount has been checked against our own record.
 */
export async function activateSubscription(
  businessId: string,
  input: { plan: string; billingPeriod: PlanBillingPeriod; amount: number; providerRef?: string },
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + planDurationMs(input.billingPeriod));
  const [subRows] = await atomic((d) => [
    d
      .insert(subscriptions)
      .values({
        businessId,
        plan: input.plan as never,
        billingPeriod: input.billingPeriod as never,
        amount: input.amount,
        status: "ACTIVE" as never,
        providerRef: input.providerRef ?? null,
        startedAt: now,
        expiresAt,
      })
      .returning(),
    d.update(businesses).set({ plan: input.plan as never }).where(eq(businesses.id, businessId)).returning(),
  ]);
  const sub = (subRows as unknown as { id: string }[])[0];
  return { subscription: sub, expiresAt };
}

// ── Platform administrators ───────────────────────────────────────────────────
// Authorisation is `users.role === 'admin'` (enforced by adminProcedure). These
// rows carry the platform-side profile for such an account.

export async function getPlatformAdminByUserId(userId: string) {
  const [row] = await db.select().from(platformAdmins).where(eq(platformAdmins.userId, userId)).limit(1);
  return row ?? null;
}

export async function listPlatformAdmins() {
  return db
    .select({
      id: platformAdmins.id,
      userId: platformAdmins.userId,
      phone: platformAdmins.phone,
      title: platformAdmins.title,
      isPlatformOwner: platformAdmins.isPlatformOwner,
      mustChangePassword: platformAdmins.mustChangePassword,
      lastPasswordChangeAt: platformAdmins.lastPasswordChangeAt,
      createdAt: platformAdmins.createdAt,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(platformAdmins)
    .innerJoin(users, eq(users.id, platformAdmins.userId))
    .orderBy(desc(platformAdmins.isPlatformOwner), asc(platformAdmins.createdAt));
}

/**
 * Change a user's password. The hash is computed here, never accepted from the
 * caller, and the platform-admin flag is cleared in the same unit so "must
 * change password" cannot survive the change it was waiting for.
 */
export async function setUserPassword(userId: string, newPassword: string) {
  const passwordHash = await bcryptHash(newPassword, 10);
  const now = new Date();
  const [userRows] = await atomic((d) => [
    d.update(users).set({ passwordHash }).where(eq(users.id, userId)).returning(),
    d
      .update(platformAdmins)
      .set({ mustChangePassword: false, lastPasswordChangeAt: now })
      .where(eq(platformAdmins.userId, userId))
      .returning(),
  ]);
  const user = (userRows as unknown as { id: string }[])[0];
  return user ?? null;
}

/** Current password hash for a user — used to verify the old password before a
 *  change. Kept here so the auth layer's own column stays untouched. */
export async function getUserPasswordHash(userId: string) {
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.passwordHash ?? null;
}

export type { MemberRole };
