# FernLeaf Kitchen Operations Admin Panel

Full-stack operations software for company catering: catalogue and company-specific pricing, employee menus, order cutoff processing, kitchen preparation, dispatch, driver delivery, invoicing, staff permissions, and role-specific dashboards.

The repository is an npm-workspaces monorepo using Next.js 14, NestJS 10, Prisma 5, and PostgreSQL. Monetary amounts are stored and calculated as integer minor units.

## Assignment coverage

All **Must** workflows in the assignment are implemented:

- Catalogue: categories (including direct-access secret categories), dishes, option groups/options, dietary and allergy metadata, activation, ordering, and minimum quantities.
- Pricing: one default tier, explicit dish/option prices, cost multipliers, parent-tier markups, and company tier assignment.
- Companies and employees: claimed domains, addresses, delivery weekdays and defaults, holidays, per-company lead time, per-employee permissions, menu visibility, and employee moves.
- Orders: employee-specific menu and pricing, combination validation, drafts, placement, cutoff confirmation/rejection, search/filter/pagination, operational overrides, cancellation, audit timeline, and short-delivery corrections.
- Operations: preparation units by station, persisted planned kitchen/dispatch timestamps, grouped delivery drops, optimistic driver assignment, driver delivery confirmation, notes, and optional photo evidence.
- Billing: invoice creation from eligible uninvoiced orders, immutable snapshots, unpaid-order removal and reconciliation, paid invoice immutability, and invoice detail.
- Platform: persisted timezone/calendar/cutoff settings, four staff roles, centrally mapped permissions, and server-calculated dashboards.

The optional **Should** items intentionally deferred are portion-size ordering and employee CSV import. A legacy `allowPortions` database field is retained solely for migration compatibility; it is not exposed or used by validation. If given more time, the next priorities would be CSV import with a dry-run/error report, first-class portion models and price rules, end-to-end browser tests, and deployment/observability hardening.

Each staff account has exactly one role. Admin can manage every operational workspace and use documented overrides, but does not inherit identity-scoped Driver permissions: only the assigned Driver can open “My drops” or submit a delivery note/photo. Admin may record an exceptional delivered override from the Dispatch board; Dispatch staff can prepare and send drops but cannot confirm delivery on a driver's behalf.

No live deployment URL is stored in this repository. Add the frontend and API URLs here when deploying for submission.

## Architecture

```mermaid
flowchart LR
  Browser[Next.js web app] -->|Bearer JWT / JSON| API[NestJS API]
  API --> Auth[JWT authentication]
  API --> Permissions[Central permission guard]
  API --> Domains[Domain services]
  Domains --> Prisma[Prisma ORM]
  Prisma --> DB[(PostgreSQL)]
  Domains --> Timeline[Order timeline events]
  Domains --> Snapshots[Order and invoice snapshots]
```

`apps/web` owns presentation, authenticated navigation, and client-side form ergonomics. `apps/api` is the authority for validation, permissions, prices, cutoff decisions, state transitions, grouping, and dashboard metrics. `packages/shared` contains role and permission contracts used across the monorepo.

### Core data model

```mermaid
erDiagram
  PRICE_TIER ||--o{ COMPANY : assigned
  PRICE_TIER ||--o{ DISH_TIER_PRICE : prices
  PRICE_TIER ||--o{ OPTION_TIER_PRICE : prices
  COMPANY ||--|{ COMPANY_DOMAIN : claims
  COMPANY ||--|{ COMPANY_ADDRESS : delivers_to
  COMPANY ||--o{ EMPLOYEE : employs
  CATEGORY }o--o{ DISH : contains
  DISH }o--o{ OPTION_GROUP : configures
  OPTION_GROUP }o--o{ OPTION : contains
  EMPLOYEE ||--o{ ORDER : owns
  ORDER ||--|{ ORDER_LINE : snapshots
  ORDER_LINE ||--|{ ORDER_COMBINATION : splits
  ORDER ||--o{ KITCHEN_UNIT : prepares
  DROP ||--|{ ORDER : groups
  STAFF_USER ||--o{ DROP : drives
  COMPANY ||--o{ INVOICE : billed
  INVOICE }o--o{ ORDER : snapshots
```

## Business rules and decisions

- The configured kitchen timezone is the source of truth for “today,” cutoff instants, boards, and dashboards. Dates are persisted as date-only UTC values; operational timestamps are absolute instants.
- Actual cutoff = delivery date minus the configured number of kitchen working days, at the configured cutoff time. Kitchen holidays and working weekdays affect this calculation; company holidays do not.
- Planned dispatch-ready time = delivery instant minus the company delivery lead. Planned kitchen-ready time = planned dispatch-ready time minus the platform kitchen-ready buffer. Both are persisted on the order and copied to preparation units.
- A normal menu omits secret categories. An explicitly addressed secret-category endpoint may return one, while still applying active-state, company visibility, and pricing rules.
- Effective dish/option price precedence is explicit tier value, then cost multiplier, then parent-tier markup. Missing prices make an item unavailable. Option-group assignments do not add a second hidden surcharge.
- Every combination quantity must be positive and combination quantities must sum to the line quantity. Required groups appear exactly once per combination and an option must belong to its selected group.
- The cutoff processor is idempotent. Drafts reject; placed orders confirm, become billable, receive preparation units and planned timestamps, and enter operational grouping when ready.
- Dispatch drops group orders by address, delivery date, and delivery time. Starting a grouped drop is blocked until every matching ready order is attached. Driver assignment uses optimistic concurrency.
- Confirmed-through-kitchen-ready orders can receive admin delivery-detail overrides; planned times are recalculated. Changes are blocked once dispatch begins.
- Admin cancellation is allowed before dispatch, removes operational units/grouping, and makes the order non-billable. Orders must be removed from unpaid invoices first; paid invoices are immutable.
- A short-delivery correction is represented by an audited negative order line so the invariant `order total = sum(order lines)` remains true. It cannot increase the original total.
- Invoice amounts are snapshots. Adding or removing an order always reconciles the invoice total; an empty invoice is deleted.

## Dashboard metric definitions

- Admin, for the current kitchen-local delivery date: order count; value of billable orders; count of billable uninvoiced orders; non-delivered drops whose planned delivery time has passed; and draft/placed orders requiring attention.
- Kitchen, for that delivery date: pending, started, and completed unit counts; at-risk units at or beyond planned kitchen-ready time; late units beyond planned dispatch time.
- Dispatch, for the kitchen-local day: kitchen-ready, dispatch-ready, out-for-delivery, unassigned ready, and late non-delivered drop counts.
- Driver, scoped to the signed-in driver and kitchen-local day: earliest remaining drop, remaining count, and completed count.

These metrics are computed by the API. The frontend only formats their returned values.

## Local setup

Prerequisites: Node.js 20+, npm, and PostgreSQL.

1. Install workspace dependencies:

   ```bash
   npm install
   ```

2. Copy `apps/api/.env.example` to `apps/api/.env` and set a real PostgreSQL `DATABASE_URL`. Set a strong `JWT_SECRET`; production startup rejects a missing secret. Copy `apps/web/.env.example` to `apps/web/.env.local`.

3. Generate the client, apply migrations, and seed demo data:

   ```bash
   npm run db:generate
   npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
   npm run db:seed
   ```

   For disposable local databases, `npm run db:push` can be used instead of migrations.

4. Start both applications:

   ```bash
   npm run dev
   ```

   Web: `http://localhost:3000`; API: `http://localhost:3001`; health: `http://localhost:3001/health`.

### Environment variables

API (`apps/api/.env`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kitchen_ops?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

Web (`apps/web/.env.local`):

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### Seeded staff accounts

All seeded accounts use password `Test@1234`:

| Role | Email |
| --- | --- |
| Admin | `admin@test.com` |
| Kitchen | `kitchen@test.com` |
| Dispatch | `dispatch@test.com` |
| Driver | `driver@test.com` |

Public registration is disabled. Admins create and deactivate staff through `/dashboard/staff`; deactivated accounts cannot log in and existing tokens are rejected.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

The automated tests cover permissions, company-domain uniqueness, pricing precedence and rounding, menu visibility, secret-category access, combination validity, cutoff timezone/calendar behavior, idempotent cutoff processing, kitchen and dispatch state machines, and billing eligibility/reconciliation.

## Repository layout

```text
apps/
  api/
    prisma/              schema, migrations, and realistic seed
    src/                 NestJS domain modules
  web/
    src/app/dashboard/   role and workflow screens
    src/lib/             API and access helpers
packages/
  shared/                shared roles, permissions, and contracts
```

## Deployment notes

Build from the repository root with `npm run build`. Before starting the API, provide `DATABASE_URL`, `JWT_SECRET`, and the deployed `FRONTEND_URL`, run Prisma generation and `prisma migrate deploy`, then start `node apps/api/dist/apps/api/src/main.js` (or use the package start script). Build the web app with its deployed `NEXT_PUBLIC_API_URL`. Do not use the example JWT secret in production.

The API refuses production startup without a database URL, an HTTPS frontend origin, and a JWT secret of at least 32 characters. It applies standard response-security headers, is proxy-aware, rate-limits login attempts and general API traffic in-process, and returns HTTP 503 from `/health` when PostgreSQL is unavailable. Run the service with Node 20, as specified in `.nvmrc` and the root `engines` field. For multiple API instances, replace the in-process rate-limit store with a shared Redis-backed limiter.
