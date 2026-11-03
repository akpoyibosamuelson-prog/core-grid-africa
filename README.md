# Core Grid Africa

**Powering Businesses. Connecting Growth.**

A full-stack business management platform for Nigerian SMEs — retailers,
wholesalers, distributors and entrepreneurs. Built with Next-generation web
tooling: React 19 + Vite + Tailwind + tRPC + Drizzle ORM on PostgreSQL.

## What's inside

| Area | Modules |
|------|---------|
| **Public site** | Home, About, Solutions, Features, Pricing, Contact, Privacy, Terms, Login, Create account |
| **Business app** | Dashboard, Sales, POS, Inventory, Purchases, Suppliers, Customers, Orders & Deliveries, Expenses, Finance, Employees, Reports, Notifications, Settings, Branches |
| **Super admin** | Platform overview, Businesses, Users, Subscriptions, Payments, Support, Audit log, Settings |

### Highlights
- **Real data, no mocks** — every figure comes from the database, scoped to the
  signed-in business.
- **Date filters** — Today, Yesterday, Last 7 days, Last 30 days, This month,
  Last month, and a custom range, applied consistently across dashboard,
  finance and reports.
- **Sales / POS** — recording a sale automatically decrements inventory and
  writes a stock movement, payment and invoice.
- **Role-based access** — OWNER, ADMIN, MANAGER, SALES STAFF, INVENTORY STAFF,
  ACCOUNTANT, EMPLOYEE, each with a module allow-list.
- **Business-level data isolation** — every query is filtered by `businessId`
  resolved from the caller's membership.
- **Naira-first** — money is stored as integer kobo; ₦ is the default currency.
- **Paystack** — server-side payment initialisation and verification.
- **CSV exports** — sales, expenses, inventory and P&L.

## Getting started

```bash
pnpm install
cp .env.example .env      # fill in DATABASE_URL, JWT_SECRET, Paystack keys
pnpm db:migrate           # apply migrations
pnpm dev                  # API on :3001, web on :3000
```

### Scripts
| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run API + web dev servers |
| `pnpm build` | Production build (web + API) |
| `pnpm start` | Run the built server |
| `pnpm test` | Vitest suite |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm db:generate` | Generate a migration from the schema |
| `pnpm db:migrate` | Apply migrations |

## Architecture

```
client/src/pages        UI (public site, business app, super admin)
client/src/components   shared UI + charts + brand
server/routers.ts       thin tRPC procedures
server/db.ts            Drizzle queries (business-scoped)
server/services/        Paystack, email
drizzle/schema.ts       database schema
shared/                 types & constants shared client↔server
```

## Security
- Passwords hashed with scrypt (bcryptjs) — never stored in plain text.
- Session cookie auth; protected routes on both client and server.
- Every business-scoped procedure asserts membership before touching data.
- Sensitive actions are written to an audit log.

## Platform administration (super admin)

The super admin dashboard lives at `/admin` and is **separate from every
business dashboard**. Authorisation is enforced **server-side**: every
`admin.*` and `platform.*` procedure runs through `platformAdminProcedure`,
which re-reads `users.role` from the database on each request (see
`server/guards.ts`). Hiding a menu item is presentation only — a non-admin who
reaches the page still receives `FORBIDDEN` from the API.

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

## Payments (Paystack)

Payments run through a **provider abstraction** (`server/services/payments/`),
so a second provider (Flutterwave, Stripe) can be added by writing one file and
registering it — no caller changes.

**Required environment variables** (Settings → Environment variables):

| Variable | Purpose |
|----------|---------|
| `PAYSTACK_SECRET_KEY` | Server-side initialisation + verification. **Never** sent to the browser. |
| `PAYSTACK_PUBLIC_KEY` | Browser-safe key, returned to the client for inline checkout. |
| `APP_URL` | Public base URL — used to build the callback URL. |

**Until these are set, online payments are disabled.** The app reports
"not configured" and `payment.initialize` / `payment.verify` throw a clear
`PRECONDITION_FAILED` naming the missing keys. No transaction is ever recorded
as successful without a real provider verification.

### How a payment is settled
1. `payment.initialize` derives the amount **server-side** from the plan +
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

## Deployment
1. Push to GitHub.
2. Import the repo on Vercel (or any Node host).
3. Set the environment variables from `.env.example`.
4. Run `pnpm db:migrate` against the production database.
5. Deploy.

---

© Core Grid Africa. All rights reserved.
