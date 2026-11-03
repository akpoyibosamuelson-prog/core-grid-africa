import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  index,
  bigint,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM TABLE — managed by the scaffold. The Agent MUST NOT redefine or drop
// the auth columns here; it only ADDS business tables below.
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null for SSO-linked users (future)
  name: text("name"),
  role: text("role").notNull().default("user"), // 'user' | 'admin' (admin = platform super admin)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// SYSTEM TABLE — managed by the scaffold, written by server/_core/storage.ts.
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    contentType: text("content_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("files_owner_idx").on(t.ownerId), index("files_created_idx").on(t.createdAt)],
);

// ─────────────────────────────────────────────────────────────────────────────
// CORE GRID AFRICA — BUSINESS TABLES
// Money is stored as INTEGER KOBO (1 NGN = 100 kobo) to avoid float drift.
// Every business-scoped table carries businessId (FK, indexed) for isolation.
// ─────────────────────────────────────────────────────────────────────────────

export const memberRole = pgEnum("member_role", [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SALES_STAFF",
  "INVENTORY_STAFF",
  "ACCOUNTANT",
  "EMPLOYEE",
]);

export const businessStatus = pgEnum("business_status", ["ACTIVE", "SUSPENDED", "TRIAL"]);
export const planTier = pgEnum("plan_tier", ["FREE", "STARTER", "BUSINESS", "ENTERPRISE"]);
export const billingPeriod = pgEnum("billing_period", ["MONTHLY", "ANNUAL"]);
export const subscriptionStatus = pgEnum("subscription_status", ["ACTIVE", "EXPIRED", "CANCELLED", "TRIAL"]);
export const paymentMethod = pgEnum("payment_method", ["CASH", "BANK_TRANSFER", "POS", "ONLINE", "OTHER"]);
export const paymentStatus = pgEnum("payment_status", ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"]);
export const saleStatus = pgEnum("sale_status", ["COMPLETED", "CANCELLED", "REFUNDED"]);
export const purchaseStatus = pgEnum("purchase_status", ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"]);
export const orderStatus = pgEnum("order_status", [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);
export const deliveryStatus = pgEnum("delivery_status", ["PENDING", "IN_TRANSIT", "DELIVERED", "FAILED"]);
export const stockMovementType = pgEnum("stock_movement_type", ["IN", "OUT", "ADJUSTMENT", "TRANSFER"]);
export const employeeStatus = pgEnum("employee_status", ["ACTIVE", "INACTIVE", "SUSPENDED"]);
export const txStatus = pgEnum("tx_status", ["PENDING", "SUCCESS", "FAILED", "ABANDONED"]);
export const txType = pgEnum("tx_type", ["SALE", "PURCHASE", "SUBSCRIPTION"]);
export const notificationType = pgEnum("notification_type", [
  "SALE",
  "ORDER",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "CUSTOMER",
  "PAYMENT",
  "PAYMENT_FAILED",
  "SYSTEM",
]);

// ── Businesses & membership ──────────────────────────────────────────────────
export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    industry: text("industry"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    country: text("country").notNull().default("Nigeria"),
    currency: text("currency").notNull().default("NGN"),
    currencySymbol: text("currency_symbol").notNull().default("₦"),
    taxRate: integer("tax_rate").notNull().default(0), // basis points (750 = 7.5%)
    logoUrl: text("logo_url"),
    invoicePrefix: text("invoice_prefix").notNull().default("INV"),
    receiptFooter: text("receipt_footer"),
    plan: planTier("plan").notNull().default("FREE"),
    status: businessStatus("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("businesses_owner_idx").on(t.ownerId),
    uniqueIndex("businesses_slug_idx").on(t.slug),
  ],
);

export const businessMembers = pgTable(
  "business_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("EMPLOYEE"),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE | INVITED | DISABLED
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("members_business_idx").on(t.businessId),
    index("members_user_idx").on(t.userId),
    uniqueIndex("members_business_user_idx").on(t.businessId, t.userId),
  ],
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    managerId: uuid("manager_id").references(() => users.id, { onDelete: "set null" }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("branches_business_idx").on(t.businessId)],
);

// ── Catalogue ────────────────────────────────────────────────────────────────
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("PRODUCT"), // PRODUCT | EXPENSE
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categories_business_idx").on(t.businessId)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suppliers_business_idx").on(t.businessId)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    category: text("category"), // e.g. Retail, Wholesale, VIP
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customers_business_idx").on(t.businessId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    unit: text("unit").notNull().default("pcs"),
    costPrice: bigint("cost_price", { mode: "number" }).notNull().default(0), // kobo
    wholesalePrice: bigint("wholesale_price", { mode: "number" }).notNull().default(0),
    retailPrice: bigint("retail_price", { mode: "number" }).notNull().default(0),
    quantity: integer("quantity").notNull().default(0),
    minStockLevel: integer("min_stock_level").notNull().default(0),
    location: text("location"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_business_idx").on(t.businessId),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: stockMovementType("type").notNull(),
    quantity: integer("quantity").notNull(), // signed delta applied
    balanceAfter: integer("balance_after").notNull().default(0),
    reason: text("reason"),
    reference: text("reference"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_movements_business_idx").on(t.businessId),
    index("stock_movements_product_idx").on(t.productId),
  ],
);

// ── Sales ────────────────────────────────────────────────────────────────────
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    reference: text("reference").notNull(),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    discount: bigint("discount", { mode: "number" }).notNull().default(0),
    tax: bigint("tax", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    costTotal: bigint("cost_total", { mode: "number" }).notNull().default(0),
    amountPaid: bigint("amount_paid", { mode: "number" }).notNull().default(0),
    balance: bigint("balance", { mode: "number" }).notNull().default(0),
    paymentMethod: paymentMethod("payment_method").notNull().default("CASH"),
    paymentStatus: paymentStatus("payment_status").notNull().default("PAID"),
    status: saleStatus("status").notNull().default("COMPLETED"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sales_business_idx").on(t.businessId),
    index("sales_created_idx").on(t.createdAt),
    index("sales_customer_idx").on(t.customerId),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull(),
    costPrice: bigint("cost_price", { mode: "number" }).notNull().default(0),
    discount: bigint("discount", { mode: "number" }).notNull().default(0),
    lineTotal: bigint("line_total", { mode: "number" }).notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId)],
);

// ── Purchases ────────────────────────────────────────────────────────────────
export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    reference: text("reference").notNull(),
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    amountPaid: bigint("amount_paid", { mode: "number" }).notNull().default(0),
    balance: bigint("balance", { mode: "number" }).notNull().default(0),
    status: purchaseStatus("status").notNull().default("DRAFT"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("purchases_business_idx").on(t.businessId),
    index("purchases_supplier_idx").on(t.supplierId),
  ],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: bigint("unit_cost", { mode: "number" }).notNull(),
    lineTotal: bigint("line_total", { mode: "number" }).notNull(),
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId)],
);

// ── Expenses ─────────────────────────────────────────────────────────────────
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    paymentMethod: paymentMethod("payment_method").notNull().default("CASH"),
    expenseDate: timestamp("expense_date", { withTimezone: true }).notNull().defaultNow(),
    receiptUrl: text("receipt_url"),
    isRecurring: boolean("is_recurring").notNull().default(false),
    recurrence: text("recurrence"), // DAILY | WEEKLY | MONTHLY | YEARLY
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expenses_business_idx").on(t.businessId),
    index("expenses_date_idx").on(t.expenseDate),
  ],
);

// ── Payments & invoices ──────────────────────────────────────────────────────
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    type: txType("type").notNull().default("SALE"),
    reference: text("reference").notNull(),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
    purchaseId: uuid("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    method: paymentMethod("method").notNull().default("CASH"),
    status: txStatus("status").notNull().default("PENDING"),
    provider: text("provider"), // paystack | manual
    providerRef: text("provider_ref"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // ── Subscription billing (online payments only) ─────────────────────
    // What this transaction is buying. Null for SALE/PURCHASE records, which
    // are settled in-app rather than through a payment provider.
    plan: text("plan"), // FREE | STARTER | BUSINESS | ENTERPRISE
    billingPeriod: billingPeriod("billing_period"), // MONTHLY | ANNUAL
    // Why a provider transaction ended as FAILED / ABANDONED — shown to the
    // owner and to the platform admin, so a failure is never a bare status.
    failureReason: text("failure_reason"),
    // Provider-side detail (channel, gateway response, raw verification) kept
    // as JSON text for audit. Never contains card data.
    providerMeta: text("provider_meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_business_idx").on(t.businessId),
    uniqueIndex("payments_reference_idx").on(t.reference),
    index("payments_status_provider_idx").on(t.status, t.provider),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: paymentStatus("status").notNull().default("PAID"),
  },
  (t) => [index("invoices_business_idx").on(t.businessId)],
);

// ── Orders & deliveries ──────────────────────────────────────────────────────
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    reference: text("reference").notNull(),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    amountPaid: bigint("amount_paid", { mode: "number" }).notNull().default(0),
    paymentStatus: paymentStatus("payment_status").notNull().default("UNPAID"),
    status: orderStatus("status").notNull().default("PENDING"),
    deliveryAddress: text("delivery_address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_business_idx").on(t.businessId),
    index("orders_customer_idx").on(t.customerId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull(),
    lineTotal: bigint("line_total", { mode: "number" }).notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    courier: text("courier"),
    trackingNumber: text("tracking_number"),
    status: deliveryStatus("status").notNull().default("PENDING"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deliveries_business_idx").on(t.businessId), index("deliveries_order_idx").on(t.orderId)],
);

// ── Employees ────────────────────────────────────────────────────────────────
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: memberRole("role").notNull().default("EMPLOYEE"),
    department: text("department"),
    status: employeeStatus("status").notNull().default("ACTIVE"),
    hiredAt: timestamp("hired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("employees_business_idx").on(t.businessId)],
);

// ── Notifications ────────────────────────────────────────────────────────────
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull().default("SYSTEM"),
    title: text("title").notNull(),
    message: text("message"),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_business_idx").on(t.businessId),
    index("notifications_user_idx").on(t.userId),
  ],
);

// ── Subscriptions ────────────────────────────────────────────────────────────
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: planTier("plan").notNull().default("FREE"),
    status: subscriptionStatus("status").notNull().default("ACTIVE"),
    billingPeriod: billingPeriod("billing_period").notNull().default("MONTHLY"),
    amount: bigint("amount", { mode: "number" }).notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    providerRef: text("provider_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscriptions_business_idx").on(t.businessId)],
);

// ── Audit logs ───────────────────────────────────────────────────────────────
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: text("meta"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_business_idx").on(t.businessId), index("audit_logs_created_idx").on(t.createdAt)],
);

// ── Platform (super admin) ───────────────────────────────────────────────────
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Platform-level administrators (Core Grid Africa staff).
 *
 * The AUTHORISATION gate is `users.role === 'admin'`, enforced server-side by
 * `adminProcedure` in server/_core/trpc.ts — hiding a menu item is never the
 * protection. This table carries the platform-side profile for an account that
 * already has that role: their phone number, whether they are the founding
 * platform owner, and whether an administrator-issued password still has to be
 * changed.
 *
 * `mustChangePassword` is set when an account is bootstrapped with a password
 * somebody else chose. It is cleared the first time the holder changes it.
 */
export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phone: text("phone"),
    title: text("title").notNull().default("Platform Administrator"),
    isPlatformOwner: boolean("is_platform_owner").notNull().default(false),
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    lastPasswordChangeAt: timestamp("last_password_change_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("platform_admins_user_idx").on(t.userId)],
);

export const supportRequests = pgTable(
  "support_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name"),
    email: text("email"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("OPEN"), // OPEN | IN_PROGRESS | CLOSED
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("support_requests_status_idx").on(t.status)],
);
