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

## Deployment
1. Push to GitHub.
2. Import the repo on Vercel (or any Node host).
3. Set the environment variables from `.env.example`.
4. Run `pnpm db:migrate` against the production database.
5. Deploy.

---

© Core Grid Africa. All rights reserved.
