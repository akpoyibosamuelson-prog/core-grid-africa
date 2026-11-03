// ── AGENT-OWNED: tRPC API surface ────────────────────────────────────────────
// Thin procedures: validate with zod, resolve the caller's business membership
// (the isolation boundary), then call server/db.ts. Auth comes from _core.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { authProvider, registerLocalUser, AuthError, EmailTakenError } from "./_core/auth";
import { storageCommit, storageDeleteOwned, storageListByOwner, storagePutUrl, StorageError } from "./_core/storage";
import * as q from "./db";
import { roleCanAccess, planPrice, planIsFree, type MemberRole } from "../shared/constants";
import { slugify } from "../shared/format";
import { compare as bcryptCompare } from "bcryptjs";
import { activeProvider, providerStatus, ProviderNotConfiguredError, ProviderRequestError } from "./services/payments";
import { fulfilPayment } from "./services/payments/fulfill";
import { assertPlatformAdmin } from "./guards";
import * as analytics from "./analytics";
import { inventoryIntelligence } from "./inventory-intel";
import { buildMetrics, computeHealth, recommendations, answerQuestion } from "./advisor";
import { aiConfigured, aiModel } from "./services/ai";

// ── Membership guard ─────────────────────────────────────────────────────────
async function assertMember(userId: string, businessId: string, moduleKey?: string) {
  const m = await q.getMembership(userId, businessId);
  if (!m) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this business." });
  if (moduleKey && !roleCanAccess(m.role as MemberRole, moduleKey)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your role does not permit this action." });
  }
  return m;
}

async function assertOwnerOrAdmin(userId: string, businessId: string) {
  const m = await assertMember(userId, businessId);
  if (m.role !== "OWNER" && m.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner or an administrator can do this." });
  }
  return m;
}

/**
 * Platform-administrator gate. `adminProcedure` already checks the session's
 * role; this re-reads it from the DATABASE so a revoked role takes effect at
 * once and a stale token cannot claim admin. Every /admin procedure uses it.
 */
const platformAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  await assertPlatformAdmin(ctx.user);
  return next({ ctx });
});

const bizInput = z.object({ businessId: z.uuid() });

// ── Auth ─────────────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  signup: publicProcedure
    .input(z.object({ email: z.email(), password: z.string().min(8), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await registerLocalUser(input.email, input.password, input.name);
        await authProvider().login(ctx.c, input.email, input.password);
        return user;
      } catch (e: unknown) {
        if (e instanceof EmailTakenError) throw new TRPCError({ code: "CONFLICT", message: e.message });
        throw e;
      }
    }),

  login: publicProcedure
    .input(z.object({ email: z.email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await authProvider().login(ctx.c, input.email, input.password);
      } catch (e) {
        if (e instanceof AuthError) throw new TRPCError({ code: "UNAUTHORIZED", message: e.message });
        throw e;
      }
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await authProvider().logout(ctx.c);
    return { ok: true };
  }),

  /**
   * Change the signed-in user's own password. The current password is verified
   * first, and the new hash is computed server-side — never accepted from the
   * client. Clears the platform-admin "must change password" flag.
   */
  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const hash = await q.getUserPasswordHash(ctx.user.id);
      if (!hash) throw new TRPCError({ code: "BAD_REQUEST", message: "This account has no password to change." });
      const ok = await bcryptCompare(input.currentPassword, hash);
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your current password is incorrect." });
      await q.setUserPassword(ctx.user.id, input.newPassword);
      return { ok: true };
    }),
});

// ── Business ─────────────────────────────────────────────────────────────────
const businessRouter = router({
  listMine: protectedProcedure.query(({ ctx }) => q.listMembershipsForUser(ctx.user.id)),

  current: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    const biz = await q.getBusiness(input.businessId);
    if (!biz) throw new TRPCError({ code: "NOT_FOUND" });
    const membership = await q.getMembership(ctx.user.id, input.businessId);
    const subscription = await q.getSubscription(input.businessId);
    return { business: biz, role: membership?.role ?? "EMPLOYEE", subscription };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        industry: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        currency: z.string().default("NGN"),
        currencySymbol: z.string().default("₦"),
        taxRate: z.number().int().min(0).max(10000).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.name) || "business";
      const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
      const biz = await q.createBusinessWithOwner({ ownerId: ctx.user.id, slug, ...input });
      await q.logAudit(biz.id, ctx.user.id, "BUSINESS_CREATED", "business", biz.id, { name: biz.name });
      return biz;
    }),

  update: protectedProcedure
    .input(
      bizInput.extend({
        name: z.string().min(2).optional(),
        industry: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        currency: z.string().optional(),
        currencySymbol: z.string().optional(),
        taxRate: z.number().int().min(0).max(10000).optional(),
        logoUrl: z.string().optional(),
        invoicePrefix: z.string().optional(),
        receiptFooter: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      const { businessId, ...patch } = input;
      const row = await q.updateBusiness(businessId, patch);
      await q.logAudit(businessId, ctx.user.id, "BUSINESS_UPDATED", "business", businessId, patch);
      return row;
    }),
});

// ── Branches ─────────────────────────────────────────────────────────────────
const branchRouter = router({
  list: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.listBranches(input.businessId);
  }),
  create: protectedProcedure
    .input(bizInput.extend({ name: z.string().min(1), address: z.string().optional(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      const { businessId, ...rest } = input;
      return q.createBranch(businessId, rest);
    }),
  remove: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      return q.deleteBranch(input.businessId, input.id);
    }),
});

// ── Categories ───────────────────────────────────────────────────────────────
const categoryRouter = router({
  list: protectedProcedure
    .input(bizInput.extend({ kind: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listCategories(input.businessId, input.kind);
    }),
  create: protectedProcedure
    .input(bizInput.extend({ name: z.string().min(1), kind: z.string().default("PRODUCT") }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "inventory");
      const { businessId, ...rest } = input;
      return q.createCategory(businessId, rest);
    }),
  remove: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "inventory");
      return q.deleteCategory(input.businessId, input.id);
    }),
});

// ── Suppliers ────────────────────────────────────────────────────────────────
const supplierRouter = router({
  list: protectedProcedure
    .input(bizInput.extend({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listSuppliers(input.businessId, input.search);
    }),
  create: protectedProcedure
    .input(
      bizInput.extend({
        name: z.string().min(1),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "suppliers");
      const { businessId, ...rest } = input;
      return q.createSupplier(businessId, rest);
    }),
  update: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }).passthrough())
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "suppliers");
      const { businessId, id, ...patch } = input;
      return q.updateSupplier(businessId, id, patch);
    }),
  remove: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "suppliers");
      return q.deleteSupplier(input.businessId, input.id);
    }),
});

// ── Customers ────────────────────────────────────────────────────────────────
const customerRouter = router({
  list: protectedProcedure
    .input(bizInput.extend({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listCustomers(input.businessId, input.search);
    }),
  listWithStats: protectedProcedure
    .input(bizInput.extend({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listCustomersWithStats(input.businessId, input.search);
    }),
  create: protectedProcedure
    .input(
      bizInput.extend({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        category: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "customers");
      const { businessId, ...rest } = input;
      const row = await q.createCustomer(businessId, rest);
      await q.createNotification(businessId, { type: "CUSTOMER", title: "New customer added", message: row.name, link: "/app/customers" });
      return row;
    }),
  update: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }).passthrough())
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "customers");
      const { businessId, id, ...patch } = input;
      return q.updateCustomer(businessId, id, patch);
    }),
  remove: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "customers");
      return q.deleteCustomer(input.businessId, input.id);
    }),
});

// ── Products / inventory ─────────────────────────────────────────────────────
const productRouter = router({
  list: protectedProcedure
    .input(bizInput.extend({ search: z.string().optional(), categoryId: z.uuid().optional(), lowStockOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      const { businessId, ...opts } = input;
      return q.listProducts(businessId, opts);
    }),
  get: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.getProduct(input.businessId, input.id);
    }),
  create: protectedProcedure
    .input(
      bizInput.extend({
        name: z.string().min(1),
        categoryId: z.uuid().optional(),
        supplierId: z.uuid().optional(),
        sku: z.string().optional(),
        barcode: z.string().optional(),
        unit: z.string().optional(),
        costPrice: z.number().int().min(0).default(0),
        wholesalePrice: z.number().int().min(0).default(0),
        retailPrice: z.number().int().min(0).default(0),
        quantity: z.number().int().min(0).default(0),
        minStockLevel: z.number().int().min(0).default(0),
        location: z.string().optional(),
        imageUrl: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "inventory");
      const { businessId, ...rest } = input;
      const row = await q.createProduct(businessId, rest);
      await q.logAudit(businessId, ctx.user.id, "PRODUCT_CREATED", "product", row.id, { name: row.name });
      return row;
    }),
  update: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }).passthrough())
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "inventory");
      const { businessId, id, ...patch } = input;
      return q.updateProduct(businessId, id, patch);
    }),
  remove: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "inventory");
      return q.deleteProduct(input.businessId, input.id);
    }),
  adjustStock: protectedProcedure
    .input(bizInput.extend({ productId: z.uuid(), delta: z.number().int(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "inventory");
      return q.adjustStock(input.businessId, { productId: input.productId, delta: input.delta, reason: input.reason, userId: ctx.user.id });
    }),
  movements: protectedProcedure
    .input(bizInput.extend({ productId: z.uuid().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listStockMovements(input.businessId, input.productId);
    }),
  summary: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.inventorySummary(input.businessId);
  }),
});

// ── Sales ────────────────────────────────────────────────────────────────────
const saleLine = z.object({
  productId: z.uuid().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().min(0),
  costPrice: z.number().int().min(0).optional(),
  discount: z.number().int().min(0).optional(),
});

const saleRouter = router({
  list: protectedProcedure
    .input(bizInput.extend({ from: z.string().optional(), to: z.string().optional(), search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listSales(input.businessId, {
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
        search: input.search,
      });
    }),
  get: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.getSale(input.businessId, input.id);
    }),
  create: protectedProcedure
    .input(
      bizInput.extend({
        branchId: z.uuid().optional(),
        customerId: z.uuid().optional(),
        reference: z.string().min(1),
        items: z.array(saleLine).min(1),
        discount: z.number().int().min(0).default(0),
        taxRate: z.number().int().min(0).max(10000).default(0),
        amountPaid: z.number().int().min(0).default(0),
        paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "POS", "ONLINE", "OTHER"]).default("CASH"),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "sales");
      const { businessId, ...rest } = input;
      const sale = await q.createSale(businessId, { userId: ctx.user.id, ...rest });
      await q.createNotification(businessId, {
        type: "SALE",
        title: "New sale recorded",
        message: `${input.reference} · ${input.items.length} item(s)`,
        link: "/app/sales",
      });
      // Low-stock alerts for any product that dropped to/below its minimum.
      for (const it of input.items) {
        if (!it.productId) continue;
        const p = await q.getProduct(businessId, it.productId);
        if (p && p.quantity <= p.minStockLevel) {
          await q.createNotification(businessId, {
            type: p.quantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
            title: p.quantity <= 0 ? "Out of stock" : "Low stock alert",
            message: `${p.name} is at ${p.quantity} ${p.unit}`,
            link: "/app/inventory",
          });
        }
      }
      return sale;
    }),
  cancel: protectedProcedure
    .input(bizInput.extend({ id: z.uuid(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      return q.cancelSale(input.businessId, input.id, ctx.user.id, input.reason);
    }),
});

// ── Purchases ────────────────────────────────────────────────────────────────
const purchaseRouter = router({
  list: protectedProcedure
    .input(bizInput.extend({ from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listPurchases(input.businessId, {
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
      });
    }),
  get: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.getPurchase(input.businessId, input.id);
    }),
  create: protectedProcedure
    .input(
      bizInput.extend({
        supplierId: z.uuid().optional(),
        branchId: z.uuid().optional(),
        reference: z.string().min(1),
        items: z
          .array(z.object({ productId: z.uuid().optional(), name: z.string().min(1), quantity: z.number().int().positive(), unitCost: z.number().int().min(0) }))
          .min(1),
        amountPaid: z.number().int().min(0).default(0),
        status: z.enum(["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"]).default("DRAFT"),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "purchases");
      const { businessId, ...rest } = input;
      return q.createPurchase(businessId, { userId: ctx.user.id, ...rest });
    }),
  receive: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "purchases");
      return q.receivePurchase(input.businessId, input.id, ctx.user.id);
    }),
});

// ── Expenses ─────────────────────────────────────────────────────────────────
const expenseRouter = router({
  list: protectedProcedure
    .input(bizInput.extend({ from: z.string().optional(), to: z.string().optional(), search: z.string().optional(), categoryId: z.uuid().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listExpenses(input.businessId, {
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
        search: input.search,
        categoryId: input.categoryId,
      });
    }),
  create: protectedProcedure
    .input(
      bizInput.extend({
        branchId: z.uuid().optional(),
        categoryId: z.uuid().optional(),
        description: z.string().min(1),
        amount: z.number().int().positive(),
        paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "POS", "ONLINE", "OTHER"]).default("CASH"),
        expenseDate: z.string().optional(),
        receiptUrl: z.string().optional(),
        isRecurring: z.boolean().default(false),
        recurrence: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "expenses");
      const { businessId, ...rest } = input;
      const row = await q.createExpense(businessId, {
        userId: ctx.user.id,
        ...rest,
        expenseDate: rest.expenseDate ? new Date(rest.expenseDate) : undefined,
      });
      await q.logAudit(businessId, ctx.user.id, "EXPENSE_CREATED", "expense", row.id, { amount: row.amount });
      return row;
    }),
  update: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }).passthrough())
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "expenses");
      const { businessId, id, ...patch } = input;
      return q.updateExpense(businessId, id, patch);
    }),
  remove: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "expenses");
      return q.deleteExpense(input.businessId, input.id);
    }),
});

// ── Orders & deliveries ──────────────────────────────────────────────────────
const orderRouter = router({
  list: protectedProcedure
    .input(bizInput.extend({ status: z.string().optional(), search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.listOrders(input.businessId, { status: input.status, search: input.search });
    }),
  get: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.getOrder(input.businessId, input.id);
    }),
  create: protectedProcedure
    .input(
      bizInput.extend({
        customerId: z.uuid().optional(),
        reference: z.string().min(1),
        items: z
          .array(z.object({ productId: z.uuid().optional(), name: z.string().min(1), quantity: z.number().int().positive(), unitPrice: z.number().int().min(0) }))
          .min(1),
        deliveryAddress: z.string().optional(),
        notes: z.string().optional(),
        amountPaid: z.number().int().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "orders");
      const { businessId, ...rest } = input;
      const order = await q.createOrder(businessId, { userId: ctx.user.id, ...rest });
      await q.createNotification(businessId, { type: "ORDER", title: "New order created", message: input.reference, link: "/app/orders" });
      return order;
    }),
  updateStatus: protectedProcedure
    .input(bizInput.extend({ id: z.uuid(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "orders");
      return q.updateOrderStatus(input.businessId, input.id, input.status, ctx.user.id);
    }),
  createDelivery: protectedProcedure
    .input(bizInput.extend({ orderId: z.uuid(), courier: z.string().optional(), trackingNumber: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "orders");
      const { businessId, ...rest } = input;
      return q.createDelivery(businessId, rest);
    }),
  updateDelivery: protectedProcedure
    .input(bizInput.extend({ id: z.uuid(), status: z.string().optional(), courier: z.string().optional(), trackingNumber: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "orders");
      const { businessId, id, ...patch } = input;
      return q.updateDelivery(businessId, id, patch);
    }),
});

// ── Employees & members ──────────────────────────────────────────────────────
const employeeRouter = router({
  list: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.listEmployees(input.businessId);
  }),
  create: protectedProcedure
    .input(
      bizInput.extend({
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(["OWNER", "ADMIN", "MANAGER", "SALES_STAFF", "INVENTORY_STAFF", "ACCOUNTANT", "EMPLOYEE"]).default("EMPLOYEE"),
        department: z.string().optional(),
        hiredAt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      const { businessId, ...rest } = input;
      return q.createEmployee(businessId, { ...rest, hiredAt: rest.hiredAt ? new Date(rest.hiredAt) : undefined });
    }),
  update: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }).passthrough())
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      const { businessId, id, ...patch } = input;
      return q.updateEmployee(businessId, id, patch);
    }),
  remove: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      return q.deleteEmployee(input.businessId, input.id);
    }),
  listMembers: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.listMembers(input.businessId);
  }),
  updateMemberRole: protectedProcedure
    .input(bizInput.extend({ memberId: z.uuid(), role: z.enum(["OWNER", "ADMIN", "MANAGER", "SALES_STAFF", "INVENTORY_STAFF", "ACCOUNTANT", "EMPLOYEE"]) }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      const row = await q.updateMemberRole(input.businessId, input.memberId, input.role);
      await q.logAudit(input.businessId, ctx.user.id, "MEMBER_ROLE_CHANGED", "member", input.memberId, { role: input.role });
      return row;
    }),
  removeMember: protectedProcedure
    .input(bizInput.extend({ memberId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      return q.removeMember(input.businessId, input.memberId);
    }),
});

// ── Notifications ────────────────────────────────────────────────────────────
const notificationRouter = router({
  list: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.listNotifications(input.businessId, ctx.user.id);
  }),
  unreadCount: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.unreadNotificationCount(input.businessId, ctx.user.id);
  }),
  markRead: protectedProcedure
    .input(bizInput.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      return q.markNotificationRead(input.businessId, ctx.user.id, input.id);
    }),
  markAllRead: protectedProcedure.input(bizInput).mutation(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.markAllNotificationsRead(input.businessId, ctx.user.id);
  }),
});

// ── Dashboard & reports ──────────────────────────────────────────────────────
const dashboardRouter = router({
  stats: protectedProcedure
    .input(bizInput.extend({ filter: z.string().default("today"), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      const { resolveDateRange } = await import("../shared/format");
      const range = resolveDateRange(input.filter, new Date(), { from: input.from, to: input.to });
      const [stats, trend, top, byCat, rp] = await Promise.all([
        q.dashboardStats(input.businessId, range.from, range.to),
        q.salesTrend(input.businessId, range.from, range.to),
        q.topProducts(input.businessId, range.from, range.to, 5),
        q.expenseByCategory(input.businessId, range.from, range.to),
        q.receivablesPayables(input.businessId),
      ]);
      return { range: { from: range.from, to: range.to }, stats, trend, topProducts: top, expenseByCategory: byCat, ...rp };
    }),
  finance: protectedProcedure
    .input(bizInput.extend({ filter: z.string().default("this_month"), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      const { resolveDateRange } = await import("../shared/format");
      const range = resolveDateRange(input.filter, new Date(), { from: input.from, to: input.to });
      const [stats, trend, byCat, rp, payments] = await Promise.all([
        q.dashboardStats(input.businessId, range.from, range.to),
        q.salesTrend(input.businessId, range.from, range.to),
        q.expenseByCategory(input.businessId, range.from, range.to),
        q.receivablesPayables(input.businessId),
        q.listPayments(input.businessId, 50),
      ]);
      return { range: { from: range.from, to: range.to }, stats, trend, expenseByCategory: byCat, ...rp, payments };
    }),
  reports: protectedProcedure
    .input(bizInput.extend({ filter: z.string().default("this_month"), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      const { resolveDateRange } = await import("../shared/format");
      const range = resolveDateRange(input.filter, new Date(), { from: input.from, to: input.to });
      const [stats, trend, top, byCat, sales, expenses, purchases, inv] = await Promise.all([
        q.dashboardStats(input.businessId, range.from, range.to),
        q.salesTrend(input.businessId, range.from, range.to),
        q.topProducts(input.businessId, range.from, range.to, 10),
        q.expenseByCategory(input.businessId, range.from, range.to),
        q.listSales(input.businessId, { from: range.from, to: range.to, limit: 500 }),
        q.listExpenses(input.businessId, { from: range.from, to: range.to }),
        q.listPurchases(input.businessId, { from: range.from, to: range.to }),
        q.inventorySummary(input.businessId),
      ]);
      return { range: { from: range.from, to: range.to }, stats, trend, topProducts: top, expenseByCategory: byCat, sales, expenses, purchases, inventory: inv };
    }),
  auditLogs: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.listAuditLogs(input.businessId);
  }),
});

// ── Payments (provider-backed) ───────────────────────────────────────────────
// The browser may ASK for a plan; it may never name a price. Every amount is
// resolved server-side from the tier + billing period, so a tampered request
// cannot buy Business for ₦1. A transaction is only ever settled by
// `fulfilPayment`, which requires an independent provider verification and an
// exact amount match — never the customer's return from the checkout page.
const paymentRouter = router({
  /** Provider status for the UI: configured? which keys are missing? */
  config: protectedProcedure.query(() => providerStatus()),

  history: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.listPaymentsDetailed(input.businessId, { limit: 100 });
  }),

  /**
   * Start a subscription payment. The amount is derived from the plan, never
   * taken from the request. When the provider is not configured this throws a
   * clear PRECONDITION_FAILED naming the missing env vars — it never invents a
   * successful transaction.
   */
  initialize: protectedProcedure
    .input(bizInput.extend({
      plan: z.enum(["FREE", "STARTER", "BUSINESS", "ENTERPRISE"]),
      billingPeriod: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      if (planIsFree(input.plan)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The Free plan needs no payment." });
      }
      const amount = planPrice(input.plan, input.billingPeriod);
      if (amount === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown plan." });

      const provider = activeProvider();
      if (!provider.isConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Online payments are not configured yet. Add ${provider.missingConfig().join(", ")} in Settings → Environment variables.`,
        });
      }

      const reference = `CGA-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await q.createPaymentRecord({
        businessId: input.businessId, type: "SUBSCRIPTION", reference, amount,
        method: "ONLINE", status: "PENDING", provider: provider.id,
        plan: input.plan, billingPeriod: input.billingPeriod,
      });

      try {
        const result = await provider.initialize({
          email: ctx.user.email,
          amount,
          reference,
          currency: "NGN",
          metadata: { businessId: input.businessId, plan: input.plan, billingPeriod: input.billingPeriod },
        });
        return { reference, amount, authorizationUrl: result.authorizationUrl, publicKey: provider.publicKey() };
      } catch (e) {
        // The record stays PENDING; the reconciliation job settles it if the
        // customer actually paid, and the owner can retry.
        if (e instanceof ProviderNotConfiguredError) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
        }
        if (e instanceof ProviderRequestError) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: e.message });
        }
        throw e;
      }
    }),

  /**
   * Verify a transaction SERVER-SIDE. The customer returning from checkout is
   * only a trigger to call this — the browser's word is never proof.
   */
  verify: protectedProcedure
    .input(bizInput.extend({ reference: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId);
      const record = await q.getPaymentByReference(input.reference);
      if (!record || record.businessId !== input.businessId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payment not found." });
      }
      if (record.status === "SUCCESS") return { outcome: "already_settled" as const };

      const provider = activeProvider();
      if (!provider.isConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Online payments are not configured yet. Add ${provider.missingConfig().join(", ")} in Settings → Environment variables.`,
        });
      }
      const result = await provider.verify(input.reference);
      const outcome = await fulfilPayment(input.reference, result);
      return { outcome: outcome.outcome, reason: outcome.reason, plan: outcome.plan };
    }),

  /**
   * Provider webhook. Public (the provider calls it), but the HMAC-SHA512
   * signature over the raw body is verified against the secret key before
   * anything is trusted. A webhook is only ever a TRIGGER to re-verify
   * server-side — the event payload is never treated as proof of payment.
   */
  webhook: publicProcedure
    .input(z.object({ rawBody: z.string(), signature: z.string().nullable() }))
    .mutation(async ({ input }) => {
      const provider = activeProvider();
      const event = await provider.parseWebhook(input.rawBody, {
        "x-paystack-signature": input.signature ?? undefined,
      });
      if (!event) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid webhook signature." });
      if (!event.reference) return { ok: true, ignored: true };

      const record = await q.getPaymentByReference(event.reference);
      if (!record) return { ok: true, ignored: true };

      if (event.event === "charge.success") {
        // Re-verify independently — never trust the event body alone.
        const result = await provider.verify(event.reference);
        const outcome = await fulfilPayment(event.reference, result);
        return { ok: true, outcome: outcome.outcome };
      }
      if (event.event === "charge.failed") {
        await q.markPaymentFailed(event.reference, "Provider reported a failed charge.");
        return { ok: true, outcome: "failed" };
      }
      return { ok: true, ignored: true };
    }),
});

// ── Subscriptions ────────────────────────────────────────────────────────────
const subscriptionRouter = router({
  current: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.getSubscription(input.businessId);
  }),
  /**
   * Move to the FREE plan directly (a downgrade needs no payment). Upgrading to
   * a paid plan goes through `payment.initialize` — the amount is never taken
   * from the client.
   */
  change: protectedProcedure
    .input(bizInput.extend({ plan: z.enum(["FREE", "STARTER", "BUSINESS", "ENTERPRISE"]), billingPeriod: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY") }))
    .mutation(async ({ ctx, input }) => {
      await assertOwnerOrAdmin(ctx.user.id, input.businessId);
      if (!planIsFree(input.plan)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Paid plans are activated by completing payment. Start the payment from Settings → Subscription.",
        });
      }
      const row = await q.setSubscription(input.businessId, { plan: input.plan, billingPeriod: input.billingPeriod, amount: 0 });
      await q.logAudit(input.businessId, ctx.user.id, "SUBSCRIPTION_CHANGED", "subscription", row.id, { plan: input.plan });
      return row;
    }),
});

// ── Support ──────────────────────────────────────────────────────────────────
const supportRouter = router({
  submit: publicProcedure
    .input(z.object({ name: z.string().optional(), email: z.string().optional(), subject: z.string().min(1), message: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const row = await q.createSupportRequest(input);
      return { ok: true, id: row.id };
    }),
});

// ── Platform admin (super admin) ─────────────────────────────────────────────
const adminRouter = router({
  stats: platformAdminProcedure.query(() => q.platformStats()),
  businesses: platformAdminProcedure.query(() => q.listAllBusinesses()),
  users: platformAdminProcedure.query(() => q.listAllUsers()),
  subscriptions: platformAdminProcedure.query(() => q.listAllSubscriptions()),
  payments: platformAdminProcedure.query(() => q.listAllPayments()),
  auditLogs: platformAdminProcedure.query(() => q.listAllAuditLogs()),
  support: platformAdminProcedure.query(() => q.listSupportRequests()),
  settings: platformAdminProcedure.query(() => q.getPlatformSettings()),
  setBusinessStatus: platformAdminProcedure
    .input(z.object({ businessId: z.uuid(), status: z.enum(["ACTIVE", "SUSPENDED", "TRIAL"]) }))
    .mutation(({ input }) => q.setBusinessStatus(input.businessId, input.status)),
  updateSupportStatus: platformAdminProcedure
    .input(z.object({ id: z.uuid(), status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]) }))
    .mutation(({ input }) => q.updateSupportStatus(input.id, input.status)),
  setSetting: platformAdminProcedure
    .input(z.object({ key: z.string().min(1), value: z.string() }))
    .mutation(({ input }) => q.setPlatformSetting(input.key, input.value)),
});

// ── Platform administration (super admin) ────────────────────────────────────
// Separate from business dashboards. Every procedure is gated by
// platformAdminProcedure, which re-reads the role from the database.
const platformRouter = router({
  me: platformAdminProcedure.query(async ({ ctx }) => {
    const admin = await q.getPlatformAdminByUserId(ctx.user.id);
    return {
      user: ctx.user,
      phone: admin?.phone ?? null,
      title: admin?.title ?? "Platform Administrator",
      isPlatformOwner: admin?.isPlatformOwner ?? false,
      mustChangePassword: admin?.mustChangePassword ?? false,
      lastPasswordChangeAt: admin?.lastPasswordChangeAt ?? null,
    };
  }),
  admins: platformAdminProcedure.query(() => q.listPlatformAdmins()),
});

// ── Files (uploads) ──────────────────────────────────────────────────────────
export function sanitizeBasename(name: string): string {
  const last = name.split(/[/\\]/).pop() ?? "";
  const dot = last.lastIndexOf(".");
  const rawStem = dot > 0 ? last.slice(0, dot) : last;
  const rawExt = dot > 0 ? last.slice(dot + 1) : "";
  const stem = rawStem.replace(/[^A-Za-z0-9._-]/g, "").replace(/^\.+/, "") || "upload";
  const ext = rawExt.replace(/[^A-Za-z0-9]/g, "").slice(0, 10);
  return ext ? `${stem}.${ext}` : stem;
}

const filesRouter = router({
  uploadUrl: protectedProcedure
    .input(z.object({ name: z.string().min(1), contentType: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const key = `${crypto.randomUUID()}-${sanitizeBasename(input.name)}`;
      try {
        const { uploadUrl, publicPath } = await storagePutUrl(key, input.contentType, { ownerId: ctx.user.id });
        return { key, uploadUrl, publicPath };
      } catch (e) {
        if (e instanceof StorageError && e.code === "failed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "upload rejected by storage — check the file type is allowed" });
        }
        throw e;
      }
    }),
  commit: protectedProcedure
    .input(z.object({ key: z.string().min(1), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await storageCommit(input.key, { ownerId: ctx.user.id, name: input.name });
      } catch (e) {
        if (e instanceof StorageError && e.code === "not_found") throw new TRPCError({ code: "NOT_FOUND", message: "upload not found" });
        if (e instanceof StorageError && e.code === "forbidden") throw new TRPCError({ code: "FORBIDDEN", message: "that key belongs to another user" });
        throw e;
      }
    }),
  list: protectedProcedure.query(({ ctx }) => storageListByOwner(ctx.user.id)),
  remove: protectedProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await storageDeleteOwned(ctx.user.id, input.key);
      } catch (e) {
        if (e instanceof StorageError && e.code === "forbidden") throw new TRPCError({ code: "BAD_REQUEST", message: "malformed key" });
        throw e;
      }
    }),
});

// ── Analytics (period intelligence) ──────────────────────────────────────────
// Every figure is computed from the caller's OWN business rows. The previous
// period is the immediately preceding window of the SAME length, so a
// comparison is always like-for-like regardless of which filter is chosen.
const analyticsRouter = router({
  overview: protectedProcedure
    .input(bizInput.extend({ filter: z.string().default("this_month"), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "reports");
      const { resolveDateRange } = await import("../shared/format");
      const range = resolveDateRange(input.filter, new Date(), { from: input.from, to: input.to });
      const span = range.to.getTime() - range.from.getTime();
      const prev = { from: new Date(range.from.getTime() - span - 1), to: new Date(range.from.getTime() - 1) };
      const [metrics, comparison, series, cash, balances, activity] = await Promise.all([
        analytics.periodMetrics(input.businessId, range.from, range.to),
        analytics.comparePeriods(input.businessId, range, prev),
        analytics.periodSeries(input.businessId, range.from, range.to, "day"),
        analytics.cashFlowStatement(input.businessId, range.from, range.to),
        analytics.cashAndBankBalances(input.businessId),
        analytics.customerActivity(input.businessId, range.from, range.to),
      ]);
      return { range: { from: range.from, to: range.to }, metrics, comparison, series, cash, balances, activity };
    }),

  pnl: protectedProcedure
    .input(bizInput.extend({ filter: z.string().default("this_month"), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "reports");
      const { resolveDateRange } = await import("../shared/format");
      const range = resolveDateRange(input.filter, new Date(), { from: input.from, to: input.to });
      const span = range.to.getTime() - range.from.getTime();
      const prev = { from: new Date(range.from.getTime() - span - 1), to: new Date(range.from.getTime() - 1) };
      const [metrics, comparison, unusual] = await Promise.all([
        analytics.periodMetrics(input.businessId, range.from, range.to),
        analytics.comparePeriods(input.businessId, range, prev),
        analytics.unusualExpenses(input.businessId, range.from, range.to),
      ]);
      return { range: { from: range.from, to: range.to }, metrics, comparison, unusual };
    }),

  series: protectedProcedure
    .input(bizInput.extend({ filter: z.string().default("this_month"), bucket: z.enum(["day", "week", "month"]).default("day"), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "reports");
      const { resolveDateRange } = await import("../shared/format");
      const range = resolveDateRange(input.filter, new Date(), { from: input.from, to: input.to });
      return analytics.periodSeries(input.businessId, range.from, range.to, input.bucket);
    }),

  cashflow: protectedProcedure
    .input(bizInput.extend({ filter: z.string().default("this_month"), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "finance");
      const { resolveDateRange } = await import("../shared/format");
      const range = resolveDateRange(input.filter, new Date(), { from: input.from, to: input.to });
      const [statement, balances] = await Promise.all([
        analytics.cashFlowStatement(input.businessId, range.from, range.to),
        analytics.cashAndBankBalances(input.businessId),
      ]);
      return { range: { from: range.from, to: range.to }, statement, balances };
    }),

  customers: protectedProcedure
    .input(bizInput.extend({ filter: z.string().default("this_month"), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "reports");
      const { resolveDateRange } = await import("../shared/format");
      const range = resolveDateRange(input.filter, new Date(), { from: input.from, to: input.to });
      return analytics.customerActivity(input.businessId, range.from, range.to);
    }),

  inventory: protectedProcedure
    .input(bizInput.extend({ windowDays: z.number().int().min(7).max(180).default(30) }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "inventory");
      return inventoryIntelligence(input.businessId, input.windowDays);
    }),
});

// ── Debts (receivables & payables) ───────────────────────────────────────────
const debtsRouter = router({
  report: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId, "finance");
    return analytics.debtsReport(input.businessId);
  }),
});

// ── AI Business Advisor ──────────────────────────────────────────────────────
// The deterministic engine always answers; the language layer only rewrites it
// when a key is configured, and `source` says which one produced the answer.
const advisorRouter = router({
  status: protectedProcedure.query(() => ({ configured: aiConfigured(), model: aiModel() })),

  health: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId, "reports");
    const metrics = await buildMetrics(input.businessId);
    return computeHealth(metrics);
  }),

  recommendations: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId, "reports");
    const metrics = await buildMetrics(input.businessId);
    return { metrics, recommendations: recommendations(metrics) };
  }),

  history: protectedProcedure.input(bizInput).query(async ({ ctx, input }) => {
    await assertMember(ctx.user.id, input.businessId);
    return q.listAdvisorConversations(input.businessId, 50);
  }),

  ask: protectedProcedure
    .input(bizInput.extend({ question: z.string().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.businessId, "reports");
      const result = await answerQuestion(input.businessId, input.question);
      await q.createAdvisorConversation(input.businessId, {
        userId: ctx.user.id,
        question: input.question,
        answer: result.answer,
        topic: result.topic,
        evidence: result.evidence,
        source: result.source,
      });
      return result;
    }),
});

export const appRouter = router({
  auth: authRouter,
  business: businessRouter,
  branch: branchRouter,
  category: categoryRouter,
  supplier: supplierRouter,
  customer: customerRouter,
  product: productRouter,
  sale: saleRouter,
  purchase: purchaseRouter,
  expense: expenseRouter,
  order: orderRouter,
  employee: employeeRouter,
  notification: notificationRouter,
  dashboard: dashboardRouter,
  payment: paymentRouter,
  subscription: subscriptionRouter,
  support: supportRouter,
  admin: adminRouter,
  platform: platformRouter,
  files: filesRouter,
  analytics: analyticsRouter,
  debts: debtsRouter,
  advisor: advisorRouter,
});

export type AppRouter = typeof appRouter;
