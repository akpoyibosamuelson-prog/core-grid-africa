// Shared client/server constants.

// Session cookie name is per-app (derived from APP_SLUG) so two apps served on
// the same host cannot clobber each other's session cookie (DESIGN #13). The
// server owns the authoritative value via env; this helper keeps client/server
// in agreement.
export function sessionCookieName(slug: string): string {
  return `app_session_${slug}`;
}

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ── CORE GRID AFRICA domain constants ────────────────────────────────────────

export const BRAND = {
  name: "Core Grid Africa",
  tagline: "Powering Businesses. Connecting Growth.",
  positioning: "Digital Infrastructure for Growing Businesses",
} as const;

export const MEMBER_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SALES_STAFF",
  "INVENTORY_STAFF",
  "ACCOUNTANT",
  "EMPLOYEE",
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  MANAGER: "Manager",
  SALES_STAFF: "Sales Staff",
  INVENTORY_STAFF: "Inventory Staff",
  ACCOUNTANT: "Accountant",
  EMPLOYEE: "Employee",
};

// Which modules each role may access. OWNER/ADMIN get everything.
export const ROLE_MODULES: Record<MemberRole, string[]> = {
  OWNER: ["*"],
  ADMIN: ["*"],
  MANAGER: [
    "overview", "sales", "pos", "inventory", "purchases", "orders",
    "customers", "suppliers", "expenses", "finance", "employees", "reports", "notifications", "settings",
  ],
  SALES_STAFF: ["overview", "sales", "pos", "orders", "customers", "notifications"],
  INVENTORY_STAFF: ["overview", "inventory", "purchases", "suppliers", "notifications"],
  ACCOUNTANT: ["overview", "expenses", "finance", "reports", "notifications"],
  EMPLOYEE: ["overview", "notifications"],
};

export function roleCanAccess(role: MemberRole, moduleKey: string): boolean {
  const mods = ROLE_MODULES[role] ?? [];
  return mods.includes("*") || mods.includes(moduleKey);
}

export const PLANS = [
  {
    tier: "FREE",
    name: "Free",
    monthly: 0,
    annual: 0,
    tagline: "Get started, no card required",
    features: [
      "1 branch",
      "Up to 50 products",
      "Sales & POS",
      "Basic inventory",
      "1 user",
      "Community support",
    ],
    limits: { branches: 1, products: 50, users: 1 },
  },
  {
    tier: "STARTER",
    name: "Starter",
    monthly: 500000, // ₦5,000 in kobo
    annual: 5000000,
    tagline: "For small shops finding their feet",
    features: [
      "2 branches",
      "Up to 500 products",
      "Sales, POS & inventory",
      "Expenses & basic reports",
      "3 users",
      "Email support",
    ],
    limits: { branches: 2, products: 500, users: 3 },
  },
  {
    tier: "BUSINESS",
    name: "Business",
    monthly: 1500000, // ₦15,000
    annual: 15000000,
    tagline: "For growing multi-branch businesses",
    features: [
      "5 branches",
      "Unlimited products",
      "Full finance & reporting",
      "Purchases, suppliers & CRM",
      "10 users",
      "Priority support",
    ],
    limits: { branches: 5, products: -1, users: 10 },
  },
  {
    tier: "ENTERPRISE",
    name: "Enterprise",
    monthly: 4000000, // ₦40,000
    annual: 40000000,
    tagline: "For distributors and large operations",
    features: [
      "Unlimited branches",
      "Unlimited products",
      "Everything in Business",
      "Advanced analytics & audit logs",
      "Unlimited users",
      "Dedicated support",
    ],
    limits: { branches: -1, products: -1, users: -1 },
  },
] as const;

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Transportation",
  "Staff salaries",
  "Internet",
  "Marketing",
  "Repairs",
  "Logistics",
  "Supplies",
  "Maintenance",
  "Miscellaneous",
] as const;

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "POS", "ONLINE", "OTHER"] as const;
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  POS: "POS",
  ONLINE: "Online",
  OTHER: "Other",
};

export const DATE_FILTERS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "custom", label: "Custom range" },
] as const;
export type DateFilterKey = (typeof DATE_FILTERS)[number]["key"];

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY_FOR_PICKUP: "Ready for pickup",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  REFUNDED: "Refunded",
};

export const PURCHASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ORDERED: "Ordered",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  FAILED: "Failed",
};
