# FernLeaf Kitchen — operations admin panel

An internal panel for a fictional corporate-meal kitchen. Staff set up a menu and client companies, create boxed-meal orders **on behalf of employees**, prepare distinct meal combinations, group deliveries, and bill the company. There is no employee-facing ordering or payment app.

This is the implementation of the [Heizen engineering assignment](hiring-assignment-admin-panel.pdf). The mandated Next.js frontend calls the mandated NestJS backend over HTTP; Prisma persists data in PostgreSQL. The project is an npm-workspaces monorepo. Start with the [guided walkthrough](#guided-interviewer-walkthrough), review the [LLD patterns](#low-level-design-lld-patterns), then use the [flow and rule reference](#complete-flow-ui-and-api) to test edge cases.

## Assignment coverage

The project implements these assignment areas. Known gaps and API-only controls are called out below rather than presented as complete UI features:

- Catalogue: categories (including direct-access secret categories), dishes, option groups/options, dietary and allergy metadata, activation, ordering, and minimum quantities.
- Pricing: one default tier, explicit dish/option prices, cost multipliers, parent-tier markups, and company tier assignment.
- Companies and employees: claimed domains, addresses, delivery weekdays and defaults, holidays, per-company lead time, per-employee permissions, menu visibility, and employee moves.
- Orders: employee-specific menu and pricing, combination validation, drafts, placement, cutoff confirmation/draft cancellation, search/filter/pagination, operational overrides, cancellation, status timeline, and short-delivery corrections.
- Operations: preparation units by station, persisted planned kitchen/dispatch timestamps, grouped delivery drops, optimistic driver assignment, driver delivery confirmation, notes, and optional photo evidence.
- Billing: invoice creation from eligible uninvoiced orders, captured order totals, unpaid-order removal and reconciliation, paid invoice immutability, and an API invoice-detail endpoint (the UI shows an invoice list with its orders).
- Platform: persisted timezone/calendar/cutoff settings, four staff roles, centrally mapped permissions, and server-calculated dashboards.

The **Should** items intentionally deferred are portion-size ordering and employee CSV import. A legacy `allowPortions` field remains for migration compatibility but is not a functional portion-size feature. These were deferred to protect correctness of cutoff, prices, kitchen state and invoicing within the assignment's 48-hour scope. See [prioritisation and interpretations](#scope-trade-offs-and-interpretations).

Each staff account has exactly one role. Admin can manage the operational workspaces and use documented overrides, but does not inherit identity-scoped Driver permissions: only an assigned Driver can open “My deliveries” or submit a delivery note/photo. Admin may record an exceptional delivered override from Dispatch; Dispatch staff cannot confirm delivery on the driver's behalf.

The deployment previously used for this repository was [web on Vercel](https://fernleaf-kitchen-three.vercel.app) and [API on Render](https://fernleaf-kitchen-uxsx.onrender.com/health). These are external services, so verify availability and freshness of seeded data before an interview; see [demo data](#demo-data-and-accounts).

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

The diagram is deliberately conceptual; the actual schema is [schema.prisma](apps/api/prisma/schema.prisma). `OrderLine` stores dish name/SKU/unit price and `OrderCombinationOption` stores selected option name/price. `InvoiceOrder` stores the order total at invoice creation. `DropOrder` and `KitchenUnit` are operational records rather than extra order types.

## Low-level design (LLD) patterns

The four patterns most important to this implementation are **Strategy** for pricing, **Policy and State Machine** for business rules and legal transitions, **RBAC guards** for server-side access, and **transactional/conditional updates** for selected state transitions. The table gives each pattern's code location and the problem it solves.

| Pattern                                         | Where                                                                                                              | Why it exists                                                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Controller → service → persistence boundary** | `apps/api/src/*/*.controller.ts`, matching services, `PrismaService`                                               | Controllers handle HTTP/permissions; services own business rules and transactions; Prisma is the persistence boundary. The web app never directly changes the database.                                                          |
| **Permission map and guards (RBAC)**            | `packages/shared/src/index.ts`, `authorization/authorization.service.ts`, `PermissionGuard`, controller decorators | One role per staff account, central role-to-permission mapping, server-side enforcement. The UI uses the same permission names to show relevant navigation, but that is only a usability layer.                                  |
| **Strategy**                                    | `pricing/pricing.resolver.ts`                                                                                      | Explicit prices, parent-tier markup and cost multiplier are separate resolution strategies, so adding another price rule does not spread conditionals through order creation.                                                    |
| **Policy objects and state machines**           | `orders/domain`, `kitchen/domain`, `dispatch/domain`, `menu/menu-policies.ts`                                      | Calendar/visibility/permission decisions and legal status transitions are named, isolated and unit-testable. Illegal repeats or skipped steps fail at the API.                                                                   |
| **Saved-price and invoice snapshots**           | `OrderLine`, `OrderCombinationOption`, `InvoiceOrder` in Prisma                                                    | Catalogue or tier edits do not automatically reprice saved lines; an explicit editable-order change can replace them. Invoice items capture totals, and paid invoices cannot be financially changed.                             |
| **Transaction + conditional update**            | order placement/cancellation, cutoff, kitchen, dispatch and billing services                                       | These transitions commit with their related records. Conditional `updateMany`, a unique invoice-order relation and the drop's `updatedAt` check detect competing actions. Ordinary order edits still need optimistic versioning. |
| **Idempotent processing**                       | `CutoffProcessor`, `CutoffProcessing` unique delivery date, kitchen-unit upsert                                    | A repeated manual cutoff request does not create duplicate confirmation events or prep units.                                                                                                                                    |
| **DTO validation and exception translation**    | `main.ts` global `ValidationPipe`, `dto/`, `PrismaExceptionFilter`                                                 | Invalid requests are rejected at the API boundary and common database conflicts become actionable HTTP errors.                                                                                                                   |
| **Query projections and pagination**            | order/company/employee list services and dashboard service                                                         | Main lists are server-paginated, orders are server-filtered, and dashboard queries request only the fields/counts they need.                                                                                                     |

These are pragmatic patterns inside Nest modules, not a separate framework or a generic repository layer. The main trade-off is that some long services still combine orchestration and persistence; they are the first refactoring target if the product grows.

## Business rules and decisions

- The configured kitchen timezone is the source of truth for “today,” cutoff instants, boards, and dashboards. Calendar rules compare `YYYY-MM-DD` date keys; order delivery dates are stored in a Prisma `DateTime` field from the submitted value (the UI sends a date-only value), while operational timestamps are absolute instants.
- Actual cutoff = delivery date minus the configured number of kitchen working days, at the configured cutoff time. Kitchen holidays and working weekdays affect this calculation; company holidays do not.
- Planned dispatch-ready time = delivery instant minus the company delivery lead. Planned kitchen-ready time = planned dispatch-ready time minus the platform kitchen-ready buffer. Both are persisted on the order and copied to preparation units.
- A normal menu omits secret categories. An explicitly addressed secret-category endpoint may return one, while still applying active-state, company visibility, and pricing rules.
- Effective dish/option price precedence is explicit tier value, then parent-tier markup, then cost multiplier. Missing prices make an item unavailable. Option-group assignments do not add a second hidden surcharge.
- Every combination quantity must be positive and combination quantities must sum to the line quantity. Required groups appear exactly once per combination and an option must belong to its selected group.
- The cutoff processor is idempotent. Drafts become cancelled; placed orders become confirmed and billable, receiving preparation units and planned timestamps. The implemented trigger is a manual admin endpoint after the configured cutoff; **there is no background scheduler**. Ready orders are grouped when the dispatch board is fetched.
- Dispatch drops group orders by address, delivery date, and delivery time. Starting a grouped drop is blocked until every matching ready order is attached. Driver assignment uses optimistic concurrency.
- Confirmed-through-kitchen-ready orders can receive admin delivery-detail overrides; planned times are recalculated. Changes are blocked once dispatch begins.
- Admin cancellation is allowed before dispatch, removes operational units/grouping, and makes the order non-billable. Orders must be removed from unpaid invoices first; paid invoices are immutable.
- A short-delivery correction is represented by a negative order line and status-timeline note so the invariant `order total = sum(order lines)` remains true. It cannot increase the original total.
- Invoice amounts are snapshots. Adding or removing an order always reconciles the invoice total; an empty invoice is deleted.

## Guided interviewer walkthrough

1. Sign in as `admin@test.com` on the [web app](https://fernleaf-kitchen-three.vercel.app). The landing dashboard points to today's work. Visit **Catalogue** to see reference lists, options/groups, dishes and ordered categories; **Pricing** to inspect default/derived tiers and missing prices; **Companies** and **Employees** to see delivery calendars, defaults, company-specific hiding and employee permissions.
2. Open **Menu preview**, choose an employee, and compare the visible categories/prices to their company's tier and hiding rules. Secret categories require the separate direct-category choice; they are not in the normal list.
3. In **Orders**, select an employee and an orderable delivery date, add a dish and valid combinations, then save a **Draft** and **Place order**. The list supports search, company/status/invoice filters, date range and pages. Open an order to inspect the stored prices, delivery details and timeline. Invalid dates, missing required options or quantities that do not add up are rejected by the API, not just the form.
4. For an order whose deadline has already passed, use the admin **Process cutoff** control. Drafts for that date are cancelled; placed orders become confirmed/billable. Repeating the action is safe. Then sign in as **Kitchen**, open the date's board and move units from pending to started/done (or directly to done).
5. Sign in as **Dispatch**. When all combinations are finished, refresh the board: matching orders form a single drop. Move it to dispatch-ready, assign an active driver if it has none, then mark it out for delivery. Sign in as **Driver** to see only that driver's drops for today and confirm delivery with an optional note/photo.
6. Back as **Admin**, open **Billing** to select billable, uninvoiced orders (confirmed or later) for one company, create an invoice and mark it paid. Before payment, an order may be removed and the invoice total is recalculated. A paid invoice cannot be financially changed.

The seed creates the four role accounts, several companies/employees, menu data and examples of every order status. Its “today” samples are positioned **when the seed command runs**; rerun the seed before a review if a long-lived deployment's example deliveries have become stale. Reseeding is not a background job.

## Complete flow: UI and API

The tables below are a behavioral map, not just a route list. The frontend shows the next useful action and friendly errors; the Nest API remains authoritative for access, dates, money and transitions. Domain routes require a bearer token; login, logout and health are public routes. Route names are relative to the API origin.

### 1. Sign-in, staff and permissions

| User action in the UI                          | API and conditions                                                    | Result / rejected case                                                                                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in (`/login`)                             | `POST /auth/login`; bcrypt password check, active staff account       | Returns JWT and role; wrong credentials or inactive accounts are rejected. `GET /auth/me` rechecks the account, so deactivation also invalidates existing tokens. Logout clears the browser session; it does not maintain a token-revocation list.                  |
| Open a dashboard/workspace                     | `GET /dashboard` and protected domain routes                          | Role-specific navigation is shown; the permission guard independently rejects forbidden API calls. Admin has broad operational permissions, Kitchen can view orders/update prep, Dispatch can view orders/update drops, Driver can access only own delivery routes. |
| Admin creates/edits staff (`/dashboard/staff`) | `GET/POST /staff`, `PATCH /staff/:id/role`, `PATCH /staff/:id/status` | Each account has one role. Only active `DRIVER` accounts can be assigned to drops. There is no public self-registration.                                                                                                                                            |

### 2. Set up catalogue, prices, companies and employees

| UI path / sequence                                                            | API and conditions                                                                                                                                                           | Result / rejected case                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Catalogue → reference data → add-ons → groups → dishes → categories**       | `/catalogue/*` CRUD-like endpoints; dishes have unique SKU, station, cost, dietary/allergen links, optional minimum quantity; groups order their options and can be required | Dish/option/category activation controls visibility. Dishes are deactivated, not hard-deleted. Category-dish assignments have their own order and active flag. Reference lists are managed by Admin.                                                                                                                                                                                                                                                                |
| **Pricing**: choose/create tier, strategy and overrides                       | `/pricing/tiers`, `/pricing/dish-price`, `/pricing/option-price`, `/pricing/missing`, `/pricing/overrides`                                                                   | Exactly one default tier; a company may choose another. An item price resolves from an explicit override, otherwise a parent-tier markup or cost multiplier, rounded **up to the next 5 minor units**. Invalid cyclic parent tiers or a simultaneous multiplier/markup rule are rejected. No resolvable dish price means no menu item.                                                                                                                              |
| **Companies**: create company, domains, addresses, calendar, defaults, hiding | `/companies` and `/:id/domains`, `/addresses`, `/working-days`, `/holidays`, `/defaults`, `/price-tier`, `/default-driver`, `/menu-visibility`                               | Creation requires at least one address and domain; domains are globally unique and a built-in denylist of common public-mail domains is enforced. Create employees first, then assign an owner from that company's employees; the database permits a temporary null owner during setup. Company holidays/non-working weekdays reject delivery **for that company**, but do not move the kitchen cutoff. Defaults provide time, packaging, delivery lead and driver. |
| **Employees**: create or move an employee; set preferences and permissions    | `/employees`, `/employees/:id`                                                                                                                                               | Each employee belongs to one company. Moving them changes future menu, tier, address and calendar checks. Address/time/packaging flags control ordinary order choices; Admin has an operational override. Moving an employee does not automatically reprice stored order lines, but an explicit edit of an editable order can replace them.                                                                                                                         |
| **Menu preview**: select employee; optionally request secret category         | `/menu/employee/:id`, `/menu/employee/:id/categories/:categoryId` (also employee aliases)                                                                                    | The API applies active category/assignment/dish/option state, company-hidden categories/items and effective pricing. Normal listing omits secret categories; direct category access may show an allowed secret category. Unpriced dishes or required groups with no available option are omitted. An item assigned to multiple categories may appear in each category, but the order picker deduplicates dishes.                                                    |

### 3. Create, edit, lock and correct orders

| UI action                                | API rule and result                                                                            | Important branch                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select employee/date in **Orders**       | `GET /orders/next-delivery-date?employeeId=...`, employee menu APIs                            | “Today” is the configured kitchen-local date. Company weekday/holiday must allow receipt; date cannot be in the past; configured cutoff must not have passed. Kitchen working days/holidays move cutoff backward.                                                                                                                                                                                                                                                                       |
| Add dish and combinations; save or place | `POST /orders` with lines and optional `place`; `POST /orders/:id/place` for an existing draft | API re-resolves the employee menu/prices and checks active/visible items, minimum quantity, positive combination quantities, exact sum to line quantity, required groups once per combination, and option membership. Total is `Σ[(dish price + selected option prices) × combination quantity]`; tax and delivery fee are zero. Snapshot lines/options and a timeline entry are stored.                                                                                                |
| Edit draft/placed order                  | `PATCH /orders/:id`                                                                            | Before cutoff, edits to lines/date/details are allowed if the target date is valid and before its own cutoff. Admin has an after-cutoff override for draft/placed orders, but replacing lines or changing date still revalidates the target delivery date and may fail. A draft alone is not billable.                                                                                                                                                                                  |
| Run cutoff                               | `POST /cutoffs/:deliveryDate/process` (Admin only)                                             | Only a valid date whose configured cutoff has passed is accepted. Pending drafts become **Cancelled**; placed orders become **Confirmed**, billable and get prep units/planned times. Repeated processing reconciles remaining pending orders without duplicating already-transitioned ones. No automatic scheduler is installed.                                                                                                                                                       |
| View/filter detail                       | `GET /orders` with page/search/company/status/invoiced/date-range query; `GET /orders/:id`     | Server pagination and filtering; detail includes lines, combinations, money, delivery and timeline. An inverted date range is rejected. `REJECTED` exists in the model/seed but cutoff processing cancels drafts; there is no ordinary UI action that creates a new rejected order.                                                                                                                                                                                                     |
| Admin override or cancel                 | `PATCH /orders/:id`, `POST /orders/:id/cancel`                                                 | After confirmation, override is limited to time/address/packaging (not date or lines) until dispatch begins; changing time replans kitchen/dispatch timestamps, and grouping changes detach a kitchen-ready drop. Admin may cancel through kitchen-ready, making it non-billable and removing prep/drop links. Dispatch-ready, out-for-delivery and delivered orders cannot be cancelled. An order on an unpaid invoice must first be removed; paid-invoice orders cannot be cancelled. |
| Short delivery / total correction        | `PATCH /orders/:id/correct-total` (Admin)                                                      | For confirmed or later orders, lower the total with a required reason. A negative adjustment line preserves `total = sum(lines)`; corrections cannot increase the original amount. Remove an unpaid invoice link first; paid invoice totals are immutable.                                                                                                                                                                                                                              |

### 4. Prepare, dispatch and deliver

```text
DRAFT → PLACED --cutoff--> CONFIRMED → KITCHEN_IN_PROGRESS → KITCHEN_READY
  └─────── cancelled at cutoff or by permitted action ────────────────→ CANCELLED
KITCHEN_READY → DISPATCH_READY → OUT_FOR_DELIVERY → DELIVERED
```

`REJECTED` is retained as a historical/model status, not the result of the current cutoff path. A unit may skip **Started** and go directly from **Pending** to **Done**; the order still records a kitchen start. A drop/order may not skip or repeat dispatch steps.

| UI action                                             | API rule and result                                                             | Important branch                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kitchen board: choose date/station, start/finish unit | `GET /kitchen/board`, `PATCH /kitchen/units/:id/status`                         | One unit per distinct line combination, routed to station or Unassigned. Only confirmed/in-progress orders can be worked. First unit start timestamps the order; all units done makes it kitchen-ready. Starting/finishing twice fails. At-risk means unfinished past planned kitchen-ready; late means unfinished past planned dispatch-ready. Admin can force-complete via `POST /orders/:id/force-complete`; that override is API-only in the current UI. |
| Dispatch board: refresh/group/assign driver           | `GET /dispatch-board`, `GET /dispatch-drivers`, `POST /drops/:id/assign-driver` | A drop groups the **same company, full address, delivery date and exact delivery time**. Refresh attaches newly ready orders; a group's dispatch cannot start while matching confirmed/in-progress orders are still unfinished or ready orders remain unattached. Company default driver is used when possible; assignment to an active Driver can be changed only before out-for-delivery.                                                                  |
| Ready → out                                           | `POST /drops/:id/dispatch-ready`, then `/out-for-delivery`                      | The whole drop and its orders advance together, transactionally. An assigned driver is mandatory for out-for-delivery. Wrong prior status, duplicate transition or concurrent change is rejected.                                                                                                                                                                                                                                                            |
| Driver confirms                                       | `GET /driver/drops/today`, `POST /driver/drops/:id/deliver`                     | Today is kitchen-local; only the authenticated assigned Driver can confirm an out-for-delivery drop. Optional note and photo are stored, delivery timestamp is recorded, `onTime = deliveredAt <= planned deliveryAt`, and all linked orders become Delivered. The photo is submitted as a data URL, not uploaded to external storage.                                                                                                                       |
| Exceptional admin delivery                            | `POST /drops/:id/delivered`                                                     | Available to Admin's override permission after out-for-delivery; this does not impersonate the Driver or create a driver note/photo.                                                                                                                                                                                                                                                                                                                         |

Planned dispatch-ready is delivery time minus the **company delivery lead** (default 60 minutes). Planned kitchen-ready is that result minus the **platform kitchen-ready buffer** (seeded at 30 minutes). These are persisted absolute instants and updated when an eligible delivery-time override occurs.

### 5. Invoice and settings

| UI action                                                               | API rule and result                                               | Important branch                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Billing: choose company and uninvoiced orders                           | `GET /billing/companies/:companyId/uninvoiced`; `POST /invoices`  | Only billable confirmed-or-later, non-cancelled orders of that company qualify. Empty/duplicate selections, another company's orders and already-invoiced orders fail. An order can belong to only one invoice (database unique constraint). Invoice total is the sum of captured order totals. |
| Remove from unpaid invoice or mark paid                                 | `DELETE /invoices/:id/orders/:orderId`; `POST /invoices/:id/paid` | Removing reconciles the amount and makes the order eligible again; removing the last order deletes the empty invoice. Once paid, invoice financial content is immutable, and its orders cannot be financially edited/cancelled/corrected.                                                       |
| Settings: change kitchen timezone, weekdays/holidays, cutoff and buffer | `GET/PATCH /settings`                                             | These persisted settings govern **future** order validation and planned times. The kitchen calendar, not each company calendar, counts backward to a cutoff. This does not retroactively reprice historical orders or run cutoff automatically.                                                 |

### Failure and concurrency paths

Authenticated UI requests submit JSON with a bearer token through `apps/web/src/lib/api.ts` and display domain validation messages (for example, “Order cutoff has passed” or “Assign a driver”). An invalid/expired token gets 401 and a message to sign in again; a forbidden role gets 403; bad input or illegal state gets 400; missing records get 404; duplicate unique values get 409 where Prisma's global filter handles them. Login/API rate limits can return 429, and `/health` returns 503 if PostgreSQL is unavailable. Network and 5xx errors are shown in plain language rather than leaking a stack trace.

Critical kitchen and drop transitions use transactions plus expected-state conditional updates. If two users try to finish the same unit, assign a driver concurrently or transition a drop twice, one request is rejected; invoicing the same order twice is also prevented by a unique database relation. Ordinary edits to an existing draft/placed order do **not** have general optimistic version checking, so the last edit may win. This is why frontend-disabled buttons are helpful but never treated as the source of truth.

## Dashboard metric definitions

`GET /dashboard` computes the figures server-side. “Today” means the date in `PlatformSettings.kitchenTimeZone` (the seed creates **Europe/London** settings; the model's unseeded default is **Asia/Kolkata**). Orders are grouped by their `deliveryDate` calendar key; drops by their absolute `deliveryAt` falling within that kitchen-local calendar day. Empty sums are returned as zero; a missing next drop is `null`.

The UI currently shows a subset of the API response: Admin sees orders, attention, uninvoiced count and late deliveries (not `todaysConfirmedValueMinor`); Kitchen sees pending, in progress, done and at risk (not `lateUnits`); Dispatch sees waiting for driver, dispatch ready, out for delivery and late drops (not `kitchenReady`); Driver sees all three of its figures. The API-only figures are defined below so their meaning is not confused with a visible card.

| Role / why                                     | API figures and exact calculation                                                                                                                                                                                                                                                                                                                                                                                                                          | What is deliberately not shown                                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin** — see workload, money and exceptions | `todaysOrders`: **all** orders dated today, including drafts/cancelled/rejected. `todaysConfirmedValueMinor`: sum of `totalMinor` for today's orders with `billable=true` (zero if none); cancelled/draft orders normally have `billable=false`. `uninvoicedOrders`: today's billable orders with `invoiced=false`. `lateDeliveries`: today's drops scheduled **before now** and not Delivered. `ordersRequiringAttention`: today's Draft + Placed orders. | No “revenue” chart or paid balance: these are order and internal-invoice figures, not cash received. Order count is intentionally not labelled as active orders. |
| **Kitchen** — know what to make next           | Today's prep-unit counts by `PENDING`, `STARTED` (`inProgress`) and `DONE`. `atRiskUnits`: unfinished units whose `plannedKitchenReadyAt <= now`; `lateUnits`: unfinished units whose `plannedDispatchAt < now`. An unfinished late unit may appear in both risk figures. Orders with no prep units contribute zero.                                                                                                                                       | No ingredient inventory or estimate of cook duration: neither exists in the model.                                                                               |
| **Dispatch** — see drops needing action        | Drops scheduled within today's kitchen-local day: `kitchenReady`, `dispatchReady`, `outForDelivery`; `waitingForDriver` counts only kitchen-ready/dispatch-ready drops with `driverId=null`; `lateDrops` counts all non-Delivered drops scheduled before now. Orders not yet attached to a drop do not count.                                                                                                                                              | No map, live GPS or route optimisation; the assignment only requires grouped stops and statuses.                                                                 |
| **Driver** — next stop and progress            | Only drops assigned to the signed-in driver and scheduled today, sorted by `deliveryAt`. `nextDrop` is the earliest not-Delivered drop (or `null`); `remainingDrops` counts all not-Delivered assigned drops; `completedDrops` counts Delivered assigned drops.                                                                                                                                                                                            | No other drivers' work, earnings, route planning or historical totals.                                                                                           |

Cancelled/rejected orders have no active prep/drop contribution in the normal workflow. A null driver is explicitly counted as unassigned by Dispatch. `lateDeliveries`/`lateDrops` are **current unfinished work**, not historical on-time performance; the latter is recorded separately as `Drop.onTime` at delivery.

## Scope, trade-offs and interpretations

- **Why these features first:** The assignment gives 48 hours and explicitly values reliable **Must** rules over superficial breadth. The implementation prioritises a full staff-created-order → kitchen → delivery → company-invoice path, plus cutoff/pricing/money tests. Portion sizes and employee CSV import are the two **Should** workflows not built. Next: CSV dry-run with row-level errors, explicit portion/size models and price rules, browser E2E tests, and a scheduled cutoff worker.
- **Cutoff interpretation:** With a two-kitchen-working-day cutoff at 16:00, a Wednesday delivery locks Monday 16:00 in the configured kitchen timezone. If Monday is a kitchen holiday, it locks the previous working day. A _company_ holiday blocks its delivery date but does not shift that cutoff. `POST /cutoffs/:date/process` is intentionally manual and only succeeds after the deadline; no cron/queue is included. Accordingly, orders do not auto-confirm merely because clock time has passed.
- **Admin versus Driver:** “Admin can override anything” is interpreted as operational authority, not the ability to act as a specific driver. This keeps ownership of driver notes/photos meaningful. Admin has a separate exceptional mark-delivered action. The permission matrix is central so a new role need not be added through ad hoc route checks.
- **Invoiced-order changes:** A paid invoice freezes financial changes. To cancel an eligible confirmed order or correct a short delivery on an **unpaid** invoice, first remove the order from that invoice; the invoice total reconciles and the order can later be reinvoiced. Delivery-detail overrides do not change money. This is the chosen answer to assignment section 4.9's ambiguous post-invoice changes.
- **Menu/pricing ambiguities:** “Secret” means unlisted, not a bypass of company hiding or active/price checks. A missing effective price hides the item; it is never presented as free. Prices are integer minor units, derived prices round upward to five minor units, and catalogue changes do not automatically reprice saved orders. An explicit editable-order line change uses current menu/prices. Each selected option has its resolved price; option-group assignment does not add a separate surcharge.
- **Operational simplifications:** One order type (individual boxed meals), company-paid invoices only, no sales tax or delivery fee, no payment gateway, external accounting, GPS routing, customer app, notifications, exports, recipes, coupons or promotional features, as directed by the PDF's out-of-scope list. The UI's photo evidence is a size-limited data URL stored on the drop: suitable for a small demonstration, but object storage, stronger server-side upload controls and a retention policy would be needed at scale.
- **Remaining production work:** Add a durable cutoff scheduler/queue, optimistic version checks for ordinary order edits, a shared rate limiter for multi-instance API hosting, richer monitoring, and browser/load tests around a 400-order kitchen day. The kitchen and dispatch boards are date-scoped but not paginated; this is a known scaling trade-off rather than a claim of proven 400-order performance. Status timeline events are workflow history, **not** a general-purpose audit log.

## Local setup

Prerequisites: Node.js 20–22 (as allowed by the root `engines` field), npm, and PostgreSQL.

1. Install workspace dependencies from the repository root:

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

4. Build the shared role/permission package, then start both applications:

   ```bash
   npm run build:shared
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

### Demo data and accounts

All seeded accounts use password `Test@1234`:

| Role     | Email               |
| -------- | ------------------- |
| Admin    | `admin@test.com`    |
| Kitchen  | `kitchen@test.com`  |
| Dispatch | `dispatch@test.com` |
| Driver   | `driver@test.com`   |

Public registration is disabled. Admins create and deactivate staff through `/dashboard/staff`; deactivated accounts cannot log in and existing tokens are rejected.

The seed also creates three companies with employees, a populated menu and tiers, and examples of draft, placed, confirmed, kitchen, dispatch, delivered, cancelled and rejected orders across past/today/future dates. It assigns demo drops to `driver@test.com`. These samples are dated relative to the day the seed runs, so rerun `npm run db:seed` before a live review if needed; the seed uses upserts for its fixed demo records. Demo credentials are required by the assignment and should not be reused for a real production service.

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
  shared/                shared roles and permissions
```

## Deployment notes

Build from the repository root with `npm run build`. Before starting the API, provide `DATABASE_URL`, `JWT_SECRET`, and the deployed `FRONTEND_URL`, run Prisma generation and `prisma migrate deploy`, then start `node apps/api/dist/apps/api/src/main.js` (or use the package start script). Build the web app with its deployed `NEXT_PUBLIC_API_URL`. Do not use the example JWT secret in production.

The API refuses production startup without a database URL, an HTTPS frontend origin, and a JWT secret of at least 32 characters. It applies standard response-security headers, is proxy-aware, rate-limits login attempts and general API traffic in-process, and returns HTTP 503 from `/health` when PostgreSQL is unavailable. Run the service with Node 20, as specified in `.nvmrc` and the root `engines` field. For multiple API instances, replace the in-process rate-limit store with a shared Redis-backed limiter.
