// ── Business analytics engine ────────────────────────────────────────────────
// Every figure is computed from the business's OWN rows, scoped by businessId.
// Money is integer kobo. A metric with no underlying rows is 0 — never a
// placeholder — and the UI renders its empty state.
import { and, asc, count, desc, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { db } from "./_core/db";
import { categories, customers, expenses, payments, products, purchases, sales, suppliers } from "../drizzle/schema";

export interface PeriodMetrics {
  from: Date;
  to: Date;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  expenses: number;
  netProfit: number;
  netMargin: number;
  cashCollected: number;
  outstanding: number;
  salesCount: number;
  expenseCount: number;
  newCustomers: number;
  avgSaleValue: number;
  inventoryValue: number;
  receivables: number;
  payables: number;
}

/** Full P&L + position for one period, straight from the database. */
export async function periodMetrics(businessId: string, from: Date, to: Date): Promise<PeriodMetrics> {
  const [salesAgg] = await db
    .select({
      revenue: sum(sales.total).mapWith(Number),
      cogs: sum(sales.costTotal).mapWith(Number),
      collected: sum(sales.amountPaid).mapWith(Number),
      outstanding: sum(sales.balance).mapWith(Number),
      n: count(sales.id).mapWith(Number),
    })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED"), gte(sales.createdAt, from), lte(sales.createdAt, to)));

  const [expAgg] = await db
    .select({ total: sum(expenses.amount).mapWith(Number), n: count(expenses.id).mapWith(Number) })
    .from(expenses)
    .where(and(eq(expenses.businessId, businessId), gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)));

  const [custAgg] = await db
    .select({ n: count(customers.id).mapWith(Number) })
    .from(customers)
    .where(and(eq(customers.businessId, businessId), gte(customers.createdAt, from), lte(customers.createdAt, to)));

  const [invAgg] = await db
    .select({ value: sql<number>`coalesce(sum(${products.quantity} * ${products.costPrice}), 0)`.mapWith(Number) })
    .from(products)
    .where(eq(products.businessId, businessId));

  const [rec] = await db
    .select({ total: sum(sales.balance).mapWith(Number) })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED")));

  const [pay] = await db
    .select({ total: sum(purchases.balance).mapWith(Number) })
    .from(purchases)
    .where(and(eq(purchases.businessId, businessId), inArray(purchases.status, ["ORDERED", "RECEIVED"])));

  const revenue = salesAgg?.revenue ?? 0;
  const cogs = salesAgg?.cogs ?? 0;
  const grossProfit = revenue - cogs;
  const expenseTotal = expAgg?.total ?? 0;
  const netProfit = grossProfit - expenseTotal;
  const salesCount = salesAgg?.n ?? 0;

  return {
    from,
    to,
    revenue,
    cogs,
    grossProfit,
    grossMargin: revenue > 0 ? grossProfit / revenue : 0,
    expenses: expenseTotal,
    netProfit,
    netMargin: revenue > 0 ? netProfit / revenue : 0,
    cashCollected: salesAgg?.collected ?? 0,
    outstanding: salesAgg?.outstanding ?? 0,
    salesCount,
    expenseCount: expAgg?.n ?? 0,
    newCustomers: custAgg?.n ?? 0,
    avgSaleValue: salesCount > 0 ? Math.round(revenue / salesCount) : 0,
    inventoryValue: invAgg?.value ?? 0,
    receivables: rec?.total ?? 0,
    payables: pay?.total ?? 0,
  };
}

/** Fractional change from `previous` to `current`. null = no baseline to compare. */
export function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

export interface PeriodComparison {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  growth: {
    revenue: number | null;
    expenses: number | null;
    grossProfit: number | null;
    netProfit: number | null;
    salesCount: number | null;
  };
}

/** Two periods side by side, with growth on each headline figure. */
export async function comparePeriods(
  businessId: string,
  current: { from: Date; to: Date },
  previous: { from: Date; to: Date },
): Promise<PeriodComparison> {
  const [c, p] = await Promise.all([
    periodMetrics(businessId, current.from, current.to),
    periodMetrics(businessId, previous.from, previous.to),
  ]);
  return {
    current: c,
    previous: p,
    growth: {
      revenue: growthPct(c.revenue, p.revenue),
      expenses: growthPct(c.expenses, p.expenses),
      grossProfit: growthPct(c.grossProfit, p.grossProfit),
      netProfit: growthPct(c.netProfit, p.netProfit),
      salesCount: growthPct(c.salesCount, p.salesCount),
    },
  };
}

export type SeriesBucket = "day" | "week" | "month";

/** Revenue + profit bucketed by day, week or month — the chart series. */
export async function periodSeries(businessId: string, from: Date, to: Date, bucket: SeriesBucket = "day") {
  // The unit is a validated enum, so it is inlined as a literal rather than
  // bound as a parameter. A bound parameter would produce a DIFFERENT
  // placeholder in the SELECT and the GROUP BY ($1 vs $6), and Postgres then
  // treats the two date_trunc calls as different expressions and rejects the
  // query with "column sales.created_at must appear in the GROUP BY clause".
  const unit = sql.raw(`'${bucket}'`);
  const trunc = sql`date_trunc(${unit}, ${sales.createdAt})`;
  return db
    .select({
      bucket: sql<string>`to_char(${trunc}, 'YYYY-MM-DD')`,
      revenue: sum(sales.total).mapWith(Number),
      profit: sql<number>`coalesce(sum(${sales.total} - ${sales.costTotal}), 0)`.mapWith(Number),
      n: count(sales.id).mapWith(Number),
    })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED"), gte(sales.createdAt, from), lte(sales.createdAt, to)))
    .groupBy(trunc)
    .orderBy(trunc);
}

export interface CashFlowStatement {
  inflow: number;
  expenseOut: number;
  purchaseOut: number;
  outflow: number;
  net: number;
}

/** Cash actually moved in the period: money received vs money paid out. */
export async function cashFlowStatement(businessId: string, from: Date, to: Date): Promise<CashFlowStatement> {
  const [inAgg] = await db
    .select({ total: sum(sales.amountPaid).mapWith(Number) })
    .from(sales)
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED"), gte(sales.createdAt, from), lte(sales.createdAt, to)));
  const [expAgg] = await db
    .select({ total: sum(expenses.amount).mapWith(Number) })
    .from(expenses)
    .where(and(eq(expenses.businessId, businessId), gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)));
  const [purAgg] = await db
    .select({ total: sum(purchases.amountPaid).mapWith(Number) })
    .from(purchases)
    .where(and(eq(purchases.businessId, businessId), gte(purchases.createdAt, from), lte(purchases.createdAt, to)));

  const inflow = inAgg?.total ?? 0;
  const expenseOut = expAgg?.total ?? 0;
  const purchaseOut = purAgg?.total ?? 0;
  const outflow = expenseOut + purchaseOut;
  return { inflow, expenseOut, purchaseOut, outflow, net: inflow - outflow };
}

export interface MethodBalance {
  method: string;
  inflow: number;
  outflow: number;
  balance: number;
}

/**
 * Cash & bank position, DERIVED from recorded transactions — not a bank feed.
 * For each payment method: money received on sales, minus money paid out on
 * purchases and expenses recorded against that method.
 */
export async function cashAndBankBalances(businessId: string) {
  const [saleIn, purchaseOut, expenseOut] = await Promise.all([
    db
      .select({ method: payments.method, total: sum(payments.amount).mapWith(Number) })
      .from(payments)
      .where(and(eq(payments.businessId, businessId), eq(payments.type, "SALE"), eq(payments.status, "SUCCESS")))
      .groupBy(payments.method),
    db
      .select({ method: payments.method, total: sum(payments.amount).mapWith(Number) })
      .from(payments)
      .where(and(eq(payments.businessId, businessId), eq(payments.type, "PURCHASE"), eq(payments.status, "SUCCESS")))
      .groupBy(payments.method),
    db
      .select({ method: expenses.paymentMethod, total: sum(expenses.amount).mapWith(Number) })
      .from(expenses)
      .where(eq(expenses.businessId, businessId))
      .groupBy(expenses.paymentMethod),
  ]);

  const methods = new Set<string>([...saleIn, ...purchaseOut, ...expenseOut].map((r) => r.method as string));
  const balances: MethodBalance[] = [...methods]
    .map((method) => {
      const inflow = saleIn.find((r) => r.method === method)?.total ?? 0;
      const out =
        (purchaseOut.find((r) => r.method === method)?.total ?? 0) +
        (expenseOut.find((r) => r.method === method)?.total ?? 0);
      return { method, inflow, outflow: out, balance: inflow - out };
    })
    .sort((a, b) => b.balance - a.balance);

  return { balances, total: balances.reduce((s, b) => s + b.balance, 0) };
}

export interface DebtRow {
  id: string;
  reference: string;
  partyName: string | null;
  partyId: string | null;
  total: number;
  amountPaid: number;
  balance: number;
  dueAt: Date | null;
  createdAt: Date;
  daysOverdue: number;
  overdue: boolean;
}

/** Who owes you, and whom you owe — with overdue ageing. */
export async function debtsReport(businessId: string) {
  const now = new Date();
  const [customerRows, supplierRows] = await Promise.all([
    db
      .select({
        id: sales.id,
        reference: sales.reference,
        partyId: sales.customerId,
        partyName: customers.name,
        total: sales.total,
        amountPaid: sales.amountPaid,
        balance: sales.balance,
        dueAt: sales.dueAt,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED"), sql`${sales.balance} > 0`))
      .orderBy(asc(sales.dueAt), desc(sales.createdAt))
      .limit(500),
    db
      .select({
        id: purchases.id,
        reference: purchases.reference,
        partyId: purchases.supplierId,
        partyName: suppliers.name,
        total: purchases.total,
        amountPaid: purchases.amountPaid,
        balance: purchases.balance,
        dueAt: purchases.dueAt,
        createdAt: purchases.createdAt,
      })
      .from(purchases)
      .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
      .where(and(eq(purchases.businessId, businessId), inArray(purchases.status, ["ORDERED", "RECEIVED"]), sql`${purchases.balance} > 0`))
      .orderBy(asc(purchases.dueAt), desc(purchases.createdAt))
      .limit(500),
  ]);

  const annotate = (rows: typeof customerRows): DebtRow[] =>
    rows.map((r) => {
      const due = r.dueAt ? new Date(r.dueAt) : null;
      const daysOverdue = due ? Math.floor((now.getTime() - due.getTime()) / 86_400_000) : 0;
      return { ...r, dueAt: due, daysOverdue: daysOverdue > 0 ? daysOverdue : 0, overdue: daysOverdue > 0 };
    });

  const receivables = annotate(customerRows);
  const payables = annotate(supplierRows);
  const total = (rows: DebtRow[]) => rows.reduce((s, r) => s + r.balance, 0);
  const overdue = (rows: DebtRow[]) => rows.filter((r) => r.overdue).reduce((s, r) => s + r.balance, 0);

  return {
    receivables,
    payables,
    totals: {
      receivable: total(receivables),
      payable: total(payables),
      overdueReceivable: overdue(receivables),
      overduePayable: overdue(payables),
      overdueCount: receivables.filter((r) => r.overdue).length,
    },
  };
}

export interface UnusualExpense {
  id: string;
  description: string;
  amount: number;
  categoryName: string | null;
  mean: number;
  threshold: number;
}

/**
 * Flag expenses that are statistical outliers within their own category
 * (amount > mean + 2 standard deviations, and above 1.5x the mean). Needs at
 * least 4 expenses in a category before it can call anything unusual — with
 * fewer, "unusual" would just mean "the biggest one".
 */
export async function unusualExpenses(businessId: string, from: Date, to: Date): Promise<UnusualExpense[]> {
  const rows = await db
    .select({
      id: expenses.id,
      description: expenses.description,
      amount: expenses.amount,
      categoryId: expenses.categoryId,
      categoryName: categories.name,
    })
    .from(expenses)
    .leftJoin(categories, eq(categories.id, expenses.categoryId))
    .where(and(eq(expenses.businessId, businessId), gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)))
    .limit(2000);

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.categoryId ?? "__none__";
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const flagged: UnusualExpense[] = [];
  for (const list of groups.values()) {
    if (list.length < 4) continue;
    const amounts = list.map((r) => r.amount);
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    const threshold = mean + 2 * Math.sqrt(variance);
    for (const r of list) {
      if (r.amount > threshold && r.amount > mean * 1.5) {
        flagged.push({
          id: r.id,
          description: r.description,
          amount: r.amount,
          categoryName: r.categoryName,
          mean: Math.round(mean),
          threshold: Math.round(threshold),
        });
      }
    }
  }
  return flagged.sort((a, b) => b.amount - a.amount).slice(0, 20);
}

/** Active / new / returning customers in a period, plus the top spenders. */
export async function customerActivity(businessId: string, from: Date, to: Date) {
  const activeRows = await db
    .select({
      customerId: sales.customerId,
      name: customers.name,
      createdAt: customers.createdAt,
      total: sum(sales.total).mapWith(Number),
      n: count(sales.id).mapWith(Number),
    })
    .from(sales)
    .innerJoin(customers, eq(customers.id, sales.customerId))
    .where(and(eq(sales.businessId, businessId), eq(sales.status, "COMPLETED"), gte(sales.createdAt, from), lte(sales.createdAt, to)))
    .groupBy(sales.customerId, customers.name, customers.createdAt);

  const returning = activeRows.filter((r) => r.createdAt && new Date(r.createdAt) < from).length;
  const topCustomers = [...activeRows].sort((a, b) => b.total - a.total).slice(0, 5);

  return {
    activeCustomers: activeRows.length,
    newCustomers: activeRows.length - returning,
    returningCustomers: returning,
    topCustomers,
  };
}
