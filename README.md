# Core Grid Africa

**Powering Businesses. Connecting Growth.**

Digital infrastructure for growing African businesses — Nigeria first. Core Grid
Africa is a full-stack business management platform for small and medium
businesses, retailers, wholesalers, distributors and entrepreneurs: record daily
activity, track stock, manage debts, read your real profit, and get AI-assisted
advice on what to do next.

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Owner / super admin login](#owner--super-admin-login)
- [Payments (Paystack)](#payments-paystack)
- [AI Business Advisor](#ai-business-advisor)
- [Project structure](#project-structure)
- [Security model](#security-model)
- [Testing](#testing)
- [Deployment](#deployment)

---

## What it does

| Area | Modules |
|------|---------|
| **Public site** | Home, About, Solutions, Features, Pricing, Contact, Privacy Policy, Terms & Conditions, Login, Create account |
| **Business app** | Overview, Sales, POS, Inventory, Purchases, Suppliers, Customers, Orders & Deliveries, Expenses, Finance, Debts, Employees, Analytics, AI Business Advisor, Reports, Notifications, Settings, Branches |
| **Super admin** | Platform overview, Businesses, Users, Subscriptions, Payments, Support, Audit log, Settings |

### Highlights

- **Real data, no mocks.** Every figure on every screen is a database query,
  scoped to the signed-in business.
- **Date filters everywhere.** Today, Yesterday, Last 7 days, Last 30 days, This
  month, Last month, and a custom range — applied consistently across the
  dashboard, finance, analytics and reports.
- **Sales / POS.** Recording a sale automatically decrements inventory, writes a
  stock movement, a payment and an invoice. Confirming a purchase increases
  inventory and records the supplier liability.
- **Business intelligence.** Analytics engine (revenue, COGS, gross/net profit,
  margins, cash flow, receivables, payables, inventory valuation, growth),
  inventory intelligence (fast/slow/dead stock, reorder points, restock
  recommendations), and a 6-dimension business health score.
- **AI Business Advisor.** Answers questions grounded in the business's own
  records. Works with no external service; upgrades to prose answers when an
  OpenAI key is configured.
- **Role-based access.** OWNER, ADMIN, MANAGER, SALES STAFF, INVENTORY STAFF,
  ACCOUNTANT, EMPLOYEE — each with a module allow-list.
- **Business-level data isolation.** Every query is filtered by `businessId`
  resolved from the caller's membership, never from client input.
- **Naira-first.** Money is stored as integer kobo; ₦ is the default currency.
- **Exports.** CSV, Excel and PDF across sales, expenses, inventory, P&L and
  analytics.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19, Vite, Tailwind CSS 4, wouter, TanStack Query |
| API | tRPC 11 over Hono (Node server) |
| Database | PostgreSQL |
| ORM | Drizzle ORM + drizzle-kit migrations |
| Auth | Session cookie (JWT via `jose`), scrypt password hashing (`bcryptjs`) |
| Payments | Paystack, behind a provider abstraction |
| Tests | Vitest |
| Language | TypeScript (strict) |

---

## Run it locally

**Requirements:** Node.js >= 20.19, pnpm 11, and a PostgreSQL database.

```bash
pnpm install

cp .env.example .env
# then edit .env — at minimum set DATABASE_URL and JWT_SECRET

pnpm db:migrate     # apply migrations
pnpm dev            # API on :3001, web on :3000
```

Open <http://localhost:3000>.

### Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run API + web dev servers together |
| `pnpm dev:api` | API only (`tsx watch`) |
| `pnpm dev:web` | Web only (Vite) |
| `pnpm build` | Production build (web + API) |
| `pnpm start` | Run the built server |
| `pnpm test` | Vitest suite |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm db:generate` | Generate a migration from the schema |
| `pnpm db:migrate` | Apply migrations |

---

## Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`** — it is git-ignored, and
`.env.example` contains placeholders only.

### Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Long random string used to sign session cookies. |

### Payments — required to take money online

| Variable | Purpose |
|----------|---------|
| `PAYSTACK_SECRET_KEY` | Server-side initialisation and verification. **Never** sent to the browser. |
| `PAYSTACK_PUBLIC_KEY` | Browser-safe key, returned to the client for inline checkout. |
| `APP_URL` | Public base URL of the deployment — used to build the Paystack callback URL. |

Get both keys from <https://dashboard.paystack.com/#/settings/developers>.

### Optional

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Enables prose answers in the AI Business Advisor. Without it the advisor still works using its built-in rules engine. |
| `OPENAI_MODEL` | Override the model (defaults to a small chat model). |
| `SUPPORT_EMAIL` | Address shown in the app for support. |
| `PORT` | API port (default `3001`). |
| `NODE_ENV` | `development` or `production`. |

### Platform-injected

On the Teamily platform these are supplied automatically — do not set them by
hand: `DB_DRIVER`, `DB_POOL_MAX`, `AUTH_PROVIDER`, `APP_SLUG`,
`APP_STORAGE_PRESIGN_URL`, `APP_STORAGE_TOKEN`.

---

## Database

PostgreSQL with Drizzle ORM. The schema lives in `drizzle/schema.ts` and covers
users, businesses, business memberships, roles, permissions, branches, products,
categories, inventory, stock movements, customers, suppliers, sales, sale items,
purchases, purchase items, expenses, payments, invoices, orders, deliveries,
employees, notifications, subscriptions and audit logs — with foreign keys,
indexes and transactional writes.

```bash
pnpm db:generate    # after editing drizzle/schema.ts
pnpm db:migrate     # apply to the database in DATABASE_URL
```

Migrations are committed under `drizzle/migrations/` so a fresh clone can build
the schema from scratch.

---

## Owner / super admin login

The super admin dashboard lives at **`/admin`** and is separate from every
business dashboard.

Authorisation is enforced **server-side**: every `admin.*` and `platform.*`
procedure runs through `platformAdminProcedure`, which re-reads `users.role`
from the database on each request (see `server/guards.ts`). Hiding a menu item
is presentation only — a non-admin who reaches the page still receives
`FORBIDDEN` from the API.

The founding platform owner is seeded by migration:

| Field | Value |
|-------|-------|
| Email | `samuelsonstarz980@gmail.com` |
| Phone | `08106596042` |
| Role | `admin` (platform owner) |

**The initial password is issued separately and must be changed on first
sign-in.** The account is flagged `must_change_password`; the Account page
(`/account`) shows a prompt and the change clears the flag. Change it there
before doing anything else.

Signing in as the owner lands on `/admin`; every other account lands on `/app`.

---

## Payments (Paystack)

Payments run through a **provider abstraction** (`server/services/payments/`),
so a second provider (Flutterwave, Stripe) can be added by writing one file and
registering it — no caller changes.

**Until the three Paystack variables are set, online payments are disabled.**
The app reports "not configured", `payment.initialize` throws a clear
`PRECONDITION_FAILED` naming the missing keys, and the webhook returns
`503 payments_not_configured`. No transaction is ever recorded as successful
without a real provider verification.

### How a payment is settled

1. `payment.initialize` derives the amount **server-side** from the plan and
   billing period (the client never names a price), writes a `PENDING` record,
   and returns the provider's checkout URL.
2. The customer pays on the provider's hosted page.
3. On return, `payment.verify` calls the provider **independently** and settles
   the record only if the provider reports success **and** the settled amount
   matches our record exactly.
4. The webhook (`POST /api/payments/webhook`) verifies the HMAC-SHA512
   signature over the raw body, then **re-verifies** — the event payload is
   never treated as proof.
5. A reconciliation job (`payments.reconcile`) sweeps stale `PENDING`
   transactions as a backstop for a missed webhook or a closed tab.

Duplicate payment is prevented at the database: the `PENDING → SUCCESS`
transition is a guarded `UPDATE`, so two concurrent verifications cannot both
settle the same reference.

**A transaction is never marked paid because the customer returned from the
checkout page** — the return trip only triggers server-side verification.

### Webhook

Point Paystack at:

```
https://<your-domain>/api/payments/webhook
```

---

## AI Business Advisor

`server/advisor.ts` computes a 6-dimension health score (sales, finance,
inventory, expenses, debts, customers) and generates evidence-based
recommendations from the business's own records.

- **No key configured** → deterministic rules engine. Fully functional.
- **`OPENAI_API_KEY` set** → the same computed facts are passed to the model for
  prose answers. The key is read server-side only and never reaches the browser.

The UI shows which engine answered.

---

## Project structure

```
client/src/pages          UI — public site, business app, super admin
client/src/components     shared UI, charts, brand
server/routers.ts         thin tRPC procedures
server/db.ts              Drizzle queries (business-scoped)
server/analytics.ts       analytics engine
server/advisor.ts         health score + recommendations
server/guards.ts          server-side authorisation
server/services/          payments (Paystack), AI, email
drizzle/schema.ts         database schema
drizzle/migrations/       committed SQL migrations
shared/                   types and constants shared client <-> server
```

---

## Security model

- Passwords hashed with scrypt (`bcryptjs`) — never stored in plain text.
- Session cookie auth; protected routes on both client and server.
- Every business-scoped procedure asserts membership before touching data, and
  resolves `businessId` from the session — never from client input.
- Role permissions are checked server-side per module and per action.
- Input validated with Zod at every procedure boundary.
- Sensitive actions are written to an audit log.
- Payment secrets live only in environment variables.
- `.env` is git-ignored; `.env.example` holds placeholders only.

---

## Testing

```bash
pnpm test        # Vitest
pnpm typecheck   # TypeScript, no emit
```

The suite covers authentication, business isolation, sales and inventory
transactions, financial calculations, payment verification rules, the admin
gate, analytics maths and the health score.

---

## Deployment

1. Push to GitHub.
2. Import the repository on Vercel (or any Node host).
3. Set the environment variables from `.env.example`.
4. Run `pnpm db:migrate` against the production database.
5. Deploy.

---

© Core Grid Africa. All rights reserved.
