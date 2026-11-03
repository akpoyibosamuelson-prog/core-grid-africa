// ── AI Business Advisor ──────────────────────────────────────────────────────
// Two layers, in this order:
//   1. A DETERMINISTIC engine that scores the business across six dimensions and
//      writes evidence-based recommendations from the real numbers. This always
//      runs, so the advisor is useful with no external service configured.
//   2. An OPTIONAL language layer (server/services/ai.ts) that rewrites the
//      answer in prose when an API key is configured. If it is not, the rules
//      answer is returned and `source` says "rules" — never "llm".
import { comparePeriods, cashFlowStatement, customerActivity, debtsReport, unusualExpenses } from "./analytics";
import { inventoryIntelligence } from "./inventory-intel";
import { resolveDateRange } from "../shared/format";
import { aiComplete, aiConfigured } from "./services/ai";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}
function pct(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}
function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}
/** Linear score: `good` → 100, `bad` → 0, clamped. */
function scoreFrom(value: number, good: number, bad: number): number {
  if (good === bad) return value >= good ? 100 : 0;
  return clamp(((value - bad) / (good - bad)) * 100);
}

export interface AdvisorMetrics {
  period: { from: Date; to: Date };
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  expenses: number;
  netProfit: number;
  netMargin: number;
  cashCollected: number;
  receivables: number;
  payables: number;
  salesCount: number;
  avgSaleValue: number;
  revenueGrowth: number | null;
  expenseGrowth: number | null;
  inventoryValue: number;
  lowStock: number;
  outOfStock: number;
  deadStock: number;
  deadStockValue: number;
  fastMoving: number;
  totalProducts: number;
  overdueReceivables: number;
  overdueCount: number;
  activeCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  unusualExpenseCount: number;
  cashNet: number;
}

/** Assemble the metric snapshot the score and the advisor reason over. */
export async function buildMetrics(businessId: string): Promise<AdvisorMetrics> {
  const now = new Date();
  const cur = resolveDateRange("this_month", now);
  const prev = resolveDateRange("last_month", now);

  const [cmp, cash, debts, inv, unusual, activity] = await Promise.all([
    comparePeriods(businessId, cur, prev),
    cashFlowStatement(businessId, cur.from, cur.to),
    debtsReport(businessId),
    inventoryIntelligence(businessId, 30),
    unusualExpenses(businessId, cur.from, cur.to),
    customerActivity(businessId, cur.from, cur.to),
  ]);

  const m = cmp.current;
  return {
    period: { from: cur.from, to: cur.to },
    revenue: m.revenue,
    cogs: m.cogs,
    grossProfit: m.grossProfit,
    grossMargin: m.grossMargin,
    expenses: m.expenses,
    netProfit: m.netProfit,
    netMargin: m.netMargin,
    cashCollected: m.cashCollected,
    receivables: m.receivables,
    payables: m.payables,
    salesCount: m.salesCount,
    avgSaleValue: m.avgSaleValue,
    revenueGrowth: cmp.growth.revenue,
    expenseGrowth: cmp.growth.expenses,
    inventoryValue: inv.summary.stockValue,
    lowStock: inv.summary.lowStock,
    outOfStock: inv.summary.outOfStock,
    deadStock: inv.summary.deadStock,
    deadStockValue: inv.summary.deadStockValue,
    fastMoving: inv.summary.fastMoving,
    totalProducts: inv.summary.totalProducts,
    overdueReceivables: debts.totals.overdueReceivable,
    overdueCount: debts.totals.overdueCount,
    activeCustomers: activity.activeCustomers,
    newCustomers: activity.newCustomers,
    returningCustomers: activity.returningCustomers,
    unusualExpenseCount: unusual.length,
    cashNet: cash.net,
  };
}

export interface HealthDimension {
  key: string;
  label: string;
  score: number;
  weight: number;
  explanation: string;
  opportunities: string[];
  actions: string[];
}

export interface HealthReport {
  overall: number;
  grade: string;
  dimensions: HealthDimension[];
  metrics: AdvisorMetrics;
  generatedAt: Date;
}

function gradeFor(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  if (score >= 40) return "Needs attention";
  return "At risk";
}

/** Pure: score a metric snapshot. No I/O, so it is directly testable. */
export function computeHealth(m: AdvisorMetrics): HealthReport {
  const dims: HealthDimension[] = [];

  // 1. Sales performance — growth and volume.
  const growthScore = m.revenueGrowth === null ? 50 : scoreFrom(m.revenueGrowth, 0.2, -0.2);
  const volumeScore = scoreFrom(m.salesCount, 30, 0);
  const salesScore = Math.round(0.6 * growthScore + 0.4 * volumeScore);
  dims.push({
    key: "sales",
    label: "Sales performance",
    score: salesScore,
    weight: 0.2,
    explanation:
      m.salesCount === 0
        ? "No sales recorded this month yet, so there is nothing to measure."
        : `${m.salesCount} sales worth ${naira(m.revenue)} this month` +
          (m.revenueGrowth === null ? " (no previous month to compare)." : `, ${pct(m.revenueGrowth)} versus last month.`),
    opportunities: [
      m.salesCount < 30 ? "Increase transaction volume — more sales at the same margin compounds quickly." : "Protect the current volume and lift the average sale value.",
      m.avgSaleValue > 0 ? `Average sale is ${naira(m.avgSaleValue)} — bundling or upselling raises it.` : "Record sales to start measuring average sale value.",
    ],
    actions: [
      "Review your top-selling products and make sure they are always in stock.",
      "Offer a small bundle or add-on at checkout to raise the average sale value.",
    ],
  });

  // 2. Financial health — margins and cash.
  const netMarginScore = scoreFrom(m.netMargin, 0.2, -0.05);
  const grossMarginScore = scoreFrom(m.grossMargin, 0.4, 0.05);
  const cashScore = m.cashNet > 0 ? 100 : m.cashNet === 0 ? 60 : 25;
  const finScore = Math.round(0.4 * netMarginScore + 0.3 * grossMarginScore + 0.3 * cashScore);
  dims.push({
    key: "finance",
    label: "Financial health",
    score: finScore,
    weight: 0.25,
    explanation:
      m.revenue === 0
        ? "No revenue this month, so margins cannot be calculated yet."
        : `Gross margin ${pct(m.grossMargin)}, net margin ${pct(m.netMargin)}, net cash flow ${naira(m.cashNet)} this month.`,
    opportunities: [
      m.netMargin < 0.1 ? "Net margin is thin — a small price or cost change moves it a lot." : "Margins are healthy; focus on growing volume without eroding them.",
      m.cashNet <= 0 ? "Cash flow is flat or negative — collect receivables faster." : "Cash flow is positive; consider putting the surplus to work.",
    ],
    actions: [
      "Review your cost of goods and renegotiate the top two supplier prices.",
      "Chase outstanding customer balances before month end.",
    ],
  });

  // 3. Inventory efficiency — availability and dead stock.
  const availability = m.totalProducts > 0 ? 1 - m.outOfStock / m.totalProducts : 1;
  const deadRatio = m.totalProducts > 0 ? m.deadStock / m.totalProducts : 0;
  const invScore = Math.round(0.6 * scoreFrom(availability, 0.95, 0.6) + 0.4 * scoreFrom(1 - deadRatio, 0.9, 0.5));
  dims.push({
    key: "inventory",
    label: "Inventory efficiency",
    score: invScore,
    weight: 0.2,
    explanation:
      m.totalProducts === 0
        ? "No products in inventory yet."
        : `${m.totalProducts} products worth ${naira(m.inventoryValue)}; ${m.outOfStock} out of stock, ${m.deadStock} not selling.`,
    opportunities: [
      m.outOfStock > 0 ? `${m.outOfStock} product(s) are out of stock — that is lost sales today.` : "Availability is good; keep fast movers topped up.",
      m.deadStock > 0 ? `${naira(m.deadStockValue)} is tied up in stock that is not selling.` : "No dead stock detected.",
    ],
    actions: [
      "Restock the out-of-stock items using the recommended quantities.",
      "Discount or bundle slow-moving stock to release the cash it holds.",
    ],
  });

  // 4. Expense management — expense ratio and outliers.
  const expenseRatio = m.revenue > 0 ? m.expenses / m.revenue : 0;
  const expenseBase = m.revenue > 0 ? scoreFrom(1 - expenseRatio, 0.8, 0.3) : 50;
  const expScore = Math.round(clamp(expenseBase - Math.min(20, m.unusualExpenseCount * 5)));
  dims.push({
    key: "expenses",
    label: "Expense management",
    score: expScore,
    weight: 0.15,
    explanation:
      m.revenue === 0
        ? "No revenue this month to measure expenses against."
        : `Expenses are ${naira(m.expenses)} — ${pct(expenseRatio)} of revenue` +
          (m.unusualExpenseCount > 0 ? `, with ${m.unusualExpenseCount} unusually large entr${m.unusualExpenseCount > 1 ? "ies" : "y"}.` : "."),
    opportunities: [
      expenseRatio > 0.5 ? "Expenses are more than half of revenue — the biggest lever you have." : "Expense ratio is under control.",
      m.unusualExpenseCount > 0 ? "Some expenses are far above their category norm — worth a look." : "No unusual expenses detected.",
    ],
    actions: [
      "List your five largest expense categories and set a monthly cap for each.",
      "Review any expense flagged as unusually large before it repeats.",
    ],
  });

  // 5. Debt management — overdue receivables.
  const overdueRatio = m.receivables > 0 ? m.overdueReceivables / m.receivables : 0;
  const debtScore = m.receivables === 0 ? 100 : Math.round(scoreFrom(1 - overdueRatio, 0.95, 0.5));
  dims.push({
    key: "debts",
    label: "Debt management",
    score: debtScore,
    weight: 0.1,
    explanation:
      m.receivables === 0
        ? "No outstanding customer balances — nothing owed to you."
        : `${naira(m.receivables)} owed to you, of which ${naira(m.overdueReceivables)} is overdue across ${m.overdueCount} invoice(s).`,
    opportunities: [
      m.overdueReceivables > 0 ? "Overdue balances are cash you have already earned but not collected." : "Receivables are current.",
      m.payables > 0 ? `You owe suppliers ${naira(m.payables)} — keep that in the cash plan.` : "No supplier balances outstanding.",
    ],
    actions: [
      "Send a payment reminder for every overdue invoice this week.",
      "Set a due date on new credit sales so overdue is measurable.",
    ],
  });

  // 6. Customer retention — returning share.
  const returningRatio = m.activeCustomers > 0 ? m.returningCustomers / m.activeCustomers : 0;
  const custScore = m.activeCustomers === 0 ? 50 : Math.round(scoreFrom(returningRatio, 0.6, 0.1));
  dims.push({
    key: "customers",
    label: "Customer retention",
    score: custScore,
    weight: 0.1,
    explanation:
      m.activeCustomers === 0
        ? "No customers bought this month yet."
        : `${m.activeCustomers} customers bought this month — ${m.returningCustomers} returning, ${m.newCustomers} new.`,
    opportunities: [
      returningRatio < 0.4 ? "Most buyers are new — repeat business is cheaper than new business." : "A healthy share of buyers come back.",
      "A simple follow-up after a purchase lifts repeat rate.",
    ],
    actions: [
      "Follow up with customers who bought once and have not returned.",
      "Record customer phone numbers so you can reach them again.",
    ],
  });

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  const overall = Math.round(dims.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight);

  return { overall, grade: gradeFor(overall), dimensions: dims, metrics: m, generatedAt: new Date() };
}

export interface Recommendation {
  id: string;
  title: string;
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
  action: string;
  impact: string;
}

/** Pure: evidence-based recommendations from the metric snapshot. */
export function recommendations(m: AdvisorMetrics): Recommendation[] {
  const out: Recommendation[] = [];

  if (m.outOfStock > 0) {
    out.push({
      id: "restock-urgent",
      title: `Restock ${m.outOfStock} out-of-stock product${m.outOfStock > 1 ? "s" : ""}`,
      category: "Inventory",
      priority: "HIGH",
      evidence: `${m.outOfStock} product(s) are at zero stock, so every sale of them is currently lost.`,
      action: "Open Inventory, filter to out-of-stock, and raise a purchase order for the recommended quantities.",
      impact: "Recovers sales you are losing today and stops customers switching to a competitor.",
    });
  }

  if (m.overdueReceivables > 0) {
    out.push({
      id: "collect-overdue",
      title: `Collect ${naira(m.overdueReceivables)} in overdue payments`,
      category: "Debts",
      priority: "HIGH",
      evidence: `${m.overdueCount} invoice(s) are past their due date, totalling ${naira(m.overdueReceivables)}.`,
      action: "Open Debts, work the overdue list top-down, and send a reminder for each.",
      impact: "Converts money you have already earned into cash in hand.",
    });
  }

  if (m.netMargin < 0.1 && m.revenue > 0) {
    out.push({
      id: "lift-margin",
      title: "Lift your net margin",
      category: "Profit",
      priority: "HIGH",
      evidence: `Net margin is ${pct(m.netMargin)} — for every ${naira(10000)} of sales you keep ${naira(Math.round(m.netMargin * 10000))}.`,
      action: "Review the cost of your top five products and test a small price increase on the least price-sensitive ones.",
      impact: "A 2-point margin gain on current revenue is worth more than most cost cuts.",
    });
  }

  if (m.revenueGrowth !== null && m.revenueGrowth < 0) {
    out.push({
      id: "reverse-decline",
      title: "Reverse the sales decline",
      category: "Sales",
      priority: "HIGH",
      evidence: `Revenue is ${pct(m.revenueGrowth)} versus last month.`,
      action: "Compare this month's top products with last month's and find what stopped selling.",
      impact: "Stops the slide before it compounds into a cash problem.",
    });
  }

  if (m.expenseGrowth !== null && m.revenueGrowth !== null && m.expenseGrowth > m.revenueGrowth) {
    out.push({
      id: "control-expenses",
      title: "Expenses are growing faster than revenue",
      category: "Expenses",
      priority: "MEDIUM",
      evidence: `Expenses moved ${pct(m.expenseGrowth)} while revenue moved ${pct(m.revenueGrowth)}.`,
      action: "Set a monthly cap on your three largest expense categories and review them weekly.",
      impact: "Protects margin without needing more sales.",
    });
  }

  if (m.deadStock > 0) {
    out.push({
      id: "clear-dead-stock",
      title: `Release ${naira(m.deadStockValue)} tied up in dead stock`,
      category: "Inventory",
      priority: "MEDIUM",
      evidence: `${m.deadStock} product(s) have not sold in the last 30 days but still hold ${naira(m.deadStockValue)} of stock value.`,
      action: "Bundle or discount them, or stop reordering them entirely.",
      impact: "Frees cash and shelf space for products that actually sell.",
    });
  }

  if (m.unusualExpenseCount > 0) {
    out.push({
      id: "review-unusual",
      title: `Review ${m.unusualExpenseCount} unusually large expense${m.unusualExpenseCount > 1 ? "s" : ""}`,
      category: "Expenses",
      priority: "MEDIUM",
      evidence: `${m.unusualExpenseCount} expense(s) this month are far above the norm for their category.`,
      action: "Open Expenses and check each flagged entry — confirm it was necessary and not a duplicate.",
      impact: "Catches errors and one-off costs before they become habits.",
    });
  }

  if (m.activeCustomers > 0 && m.returningCustomers / m.activeCustomers < 0.4) {
    out.push({
      id: "retain-customers",
      title: "Turn first-time buyers into repeat customers",
      category: "Customers",
      priority: "MEDIUM",
      evidence: `Only ${m.returningCustomers} of ${m.activeCustomers} buyers this month had bought before.`,
      action: "Follow up with recent one-time buyers and offer a reason to return.",
      impact: "Repeat customers cost far less to sell to than new ones.",
    });
  }

  if (m.lowStock > 0) {
    out.push({
      id: "reorder-low",
      title: `Reorder ${m.lowStock} low-stock product${m.lowStock > 1 ? "s" : ""}`,
      category: "Inventory",
      priority: "MEDIUM",
      evidence: `${m.lowStock} product(s) are at or below their minimum stock level.`,
      action: "Use the recommended restock quantities in Inventory to raise a purchase order.",
      impact: "Prevents a low-stock item from becoming an out-of-stock lost sale.",
    });
  }

  if (m.payables > 0 && m.cashNet <= 0) {
    out.push({
      id: "cash-plan",
      title: "Plan for supplier payments",
      category: "Finance",
      priority: "LOW",
      evidence: `You owe suppliers ${naira(m.payables)} while net cash flow this month is ${naira(m.cashNet)}.`,
      action: "Prioritise collecting receivables before the next supplier due date.",
      impact: "Avoids a cash squeeze and keeps supplier terms favourable.",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "keep-going",
      title: "Keep doing what you are doing",
      category: "General",
      priority: "LOW",
      evidence: "No urgent issues were detected in this month's numbers.",
      action: "Keep recording sales, purchases and expenses so the advisor stays accurate.",
      impact: "Consistent records are what make every other insight possible.",
    });
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return out.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ── Question answering ───────────────────────────────────────────────────────

const TOPICS: { key: string; label: string; keywords: string[] }[] = [
  { key: "revenue", label: "Increasing revenue", keywords: ["revenue", "sales", "sell", "income", "turnover", "grow"] },
  { key: "expenses", label: "Reducing expenses", keywords: ["expense", "cost", "spend", "reduce", "cut", "save"] },
  { key: "profit", label: "Improving profit margins", keywords: ["profit", "margin", "profitab"] },
  { key: "inventory", label: "Inventory optimisation", keywords: ["inventory", "stock", "restock", "reorder", "dead stock", "overstock"] },
  { key: "customers", label: "Customer acquisition and retention", keywords: ["customer", "client", "retention", "acquire", "loyal", "repeat"] },
  { key: "marketing", label: "Marketing strategies", keywords: ["marketing", "advert", "promo", "campaign", "brand"] },
  { key: "expansion", label: "Business expansion", keywords: ["expand", "scale", "branch", "new location", "second shop"] },
  { key: "pricing", label: "Pricing strategies", keywords: ["price", "pricing", "discount", "cheap", "expensive"] },
  { key: "finance", label: "Financial planning", keywords: ["cash", "finance", "budget", "loan", "debt", "plan"] },
];

export function detectTopic(question: string): { key: string; label: string } {
  const q = question.toLowerCase();
  let best: { key: string; label: string; hits: number } | null = null;
  for (const t of TOPICS) {
    const hits = t.keywords.reduce((n, k) => n + (q.includes(k) ? 1 : 0), 0);
    if (hits > 0 && (!best || hits > best.hits)) best = { key: t.key, label: t.label, hits };
  }
  return best ? { key: best.key, label: best.label } : { key: "general", label: "Business performance" };
}

/** Deterministic, grounded answer for a topic. Always available. */
export function rulesAnswer(topic: string, m: AdvisorMetrics): string {
  const lines: string[] = [];
  const head = (s: string) => lines.push(s);

  switch (topic) {
    case "revenue":
      head(`Your revenue this month is ${naira(m.revenue)} from ${m.salesCount} sales${m.revenueGrowth === null ? "" : `, ${pct(m.revenueGrowth)} versus last month`}.`);
      head("");
      head("To increase revenue:");
      head(`1. Protect availability — ${m.outOfStock} product(s) are out of stock, and each one is a sale you cannot make.`);
      head(`2. Raise the average sale. Yours is ${naira(m.avgSaleValue)}; bundling a related item at checkout lifts it without new customers.`);
      head(`3. Sell more to people who already buy from you — ${m.returningCustomers} of ${m.activeCustomers} buyers this month were returning.`);
      break;
    case "expenses":
      head(`Your expenses this month are ${naira(m.expenses)}${m.revenue > 0 ? `, which is ${pct(m.expenses / m.revenue)} of revenue` : ""}.`);
      head("");
      head("To reduce expenses:");
      head("1. Rank your expense categories by total and set a monthly cap on the top three.");
      head(`2. Review the ${m.unusualExpenseCount} expense(s) flagged as unusually large this month.`);
      head("3. Renegotiate the price of your two most expensive recurring supplies.");
      break;
    case "profit":
      head(`Gross margin is ${pct(m.grossMargin)} and net margin is ${pct(m.netMargin)}. Gross profit is ${naira(m.grossProfit)}; after ${naira(m.expenses)} of expenses, net profit is ${naira(m.netProfit)}.`);
      head("");
      head("To improve margin:");
      head("1. Review the cost price of your top five products — a small supplier saving multiplies across every sale.");
      head("2. Test a modest price increase on products that sell steadily regardless of price.");
      head("3. Cut or renegotiate the expense categories that grew fastest.");
      break;
    case "inventory":
      head(`You hold ${naira(m.inventoryValue)} of stock across ${m.totalProducts} products. ${m.fastMoving} are fast-moving, ${m.deadStock} are not selling, ${m.lowStock} are low and ${m.outOfStock} are out of stock.`);
      head("");
      head("To optimise inventory:");
      head("1. Restock the out-of-stock and low-stock items using the recommended quantities in Inventory.");
      head(`2. Clear the dead stock — it holds ${naira(m.deadStockValue)} that could be working elsewhere.`);
      head("3. Keep safety stock and supplier lead times accurate so reorder points stay reliable.");
      break;
    case "customers":
      head(`${m.activeCustomers} customers bought this month — ${m.newCustomers} new and ${m.returningCustomers} returning.`);
      head("");
      head("To grow and keep customers:");
      head("1. Follow up with one-time buyers; a repeat sale costs far less than a new one.");
      head("2. Record phone numbers and purchase history so follow-up is possible.");
      head("3. Ask your best customers what they would buy more of, and stock it.");
      break;
    case "marketing":
      head(`With ${m.activeCustomers} active customers and ${m.newCustomers} new this month, marketing should aim at the people most likely to buy.`);
      head("");
      head("Practical marketing:");
      head("1. Start with your existing customers — a message about a product they already buy converts best.");
      head("2. Promote your fast-moving products, not your whole catalogue.");
      head("3. Track which promotion produced which sales so you can repeat what works.");
      break;
    case "expansion":
      head(`Before expanding, the numbers to be sure of: net margin ${pct(m.netMargin)}, net cash flow ${naira(m.cashNet)}, and ${naira(m.receivables)} still owed to you.`);
      head("");
      head("To expand safely:");
      head("1. Confirm the current location is consistently profitable first.");
      head("2. Collect overdue receivables so expansion is funded by cash, not debt.");
      head("3. Use branch reporting to compare performance once a second location opens.");
      break;
    case "pricing":
      head(`Your gross margin is ${pct(m.grossMargin)}. Average sale value is ${naira(m.avgSaleValue)}.`);
      head("");
      head("On pricing:");
      head("1. Price from cost plus a target margin, not from what competitors charge.");
      head("2. Raise prices on steady sellers first; test on a small group before a full change.");
      head("3. Use discounts to clear dead stock, not on products that already sell.");
      break;
    case "finance":
      head(`Net cash flow this month is ${naira(m.cashNet)}. You are owed ${naira(m.receivables)} (${naira(m.overdueReceivables)} overdue) and owe suppliers ${naira(m.payables)}.`);
      head("");
      head("Financial planning:");
      head("1. Collect overdue receivables before taking on any new credit.");
      head("2. Keep a buffer covering at least one month of expenses.");
      head("3. Review the cash-flow report monthly so a squeeze is visible early.");
      break;
    default:
      head(`Here is where your business stands this month: revenue ${naira(m.revenue)}, gross profit ${naira(m.grossProfit)}, net profit ${naira(m.netProfit)}, net cash flow ${naira(m.cashNet)}.`);
      head("");
      head("The three things worth your attention:");
      head(`1. ${m.outOfStock > 0 ? `${m.outOfStock} product(s) are out of stock.` : "Stock availability is fine."}`);
      head(`2. ${m.overdueReceivables > 0 ? `${naira(m.overdueReceivables)} of receivables is overdue.` : "No overdue receivables."}`);
      head(`3. ${m.netMargin < 0.1 ? `Net margin is ${pct(m.netMargin)} — worth improving.` : `Net margin is a healthy ${pct(m.netMargin)}.`}`);
      break;
  }

  return lines.join("\n");
}

export interface AdvisorAnswer {
  answer: string;
  topic: string;
  topicLabel: string;
  source: "rules" | "llm";
  evidence: AdvisorMetrics;
}

/**
 * Answer a business question, grounded in the business's own records. Uses the
 * language layer when a key is configured, and always falls back to the rules
 * engine — so an answer is never withheld and never fabricated.
 */
export async function answerQuestion(businessId: string, question: string): Promise<AdvisorAnswer> {
  const metrics = await buildMetrics(businessId);
  const topic = detectTopic(question);
  const base = rulesAnswer(topic.key, metrics);

  if (aiConfigured()) {
    const system =
      "You are the Core Grid Africa Business Advisor for a Nigerian small business. " +
      "Answer ONLY from the metrics provided — never invent figures. Be concrete, practical and " +
      "respectful of the owner's time. Use Nigerian Naira. Give a short answer followed by a " +
      "numbered action plan of 3 to 5 steps. Do not give legal or investment advice.";
    const user =
      `Question: ${question}\n\n` +
      `Business metrics (this month, Naira):\n${JSON.stringify(
        {
          revenue: metrics.revenue / 100,
          cogs: metrics.cogs / 100,
          grossProfit: metrics.grossProfit / 100,
          grossMarginPct: Math.round(metrics.grossMargin * 100),
          expenses: metrics.expenses / 100,
          netProfit: metrics.netProfit / 100,
          netMarginPct: Math.round(metrics.netMargin * 100),
          cashNet: metrics.cashNet / 100,
          receivables: metrics.receivables / 100,
          overdueReceivables: metrics.overdueReceivables / 100,
          payables: metrics.payables / 100,
          salesCount: metrics.salesCount,
          avgSaleValue: metrics.avgSaleValue / 100,
          revenueGrowthPct: metrics.revenueGrowth === null ? null : Math.round(metrics.revenueGrowth * 100),
          inventoryValue: metrics.inventoryValue / 100,
          lowStock: metrics.lowStock,
          outOfStock: metrics.outOfStock,
          deadStock: metrics.deadStock,
          fastMoving: metrics.fastMoving,
          activeCustomers: metrics.activeCustomers,
          newCustomers: metrics.newCustomers,
          returningCustomers: metrics.returningCustomers,
        },
        null,
        2,
      )}\n\n` +
      `A deterministic analysis already produced this draft — improve on it, keep every figure accurate:\n${base}`;

    const llm = await aiComplete(system, user);
    if (llm) {
      return { answer: llm, topic: topic.key, topicLabel: topic.label, source: "llm", evidence: metrics };
    }
  }

  return { answer: base, topic: topic.key, topicLabel: topic.label, source: "rules", evidence: metrics };
}
