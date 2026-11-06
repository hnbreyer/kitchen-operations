# Kitchen Operations

A local operations workspace for a small vegan food-service business in Brazil. It supports retreats, city service, and private events, with database-backed planning views and operation management. Recipes, ingredients, reusable menu templates, and operation-specific meal plans are available. Ingredient requirements, operation substitutions, and editable shopping lists are also available. Actual ingredient purchases and school reimbursement tracking are available. Inventory ledgers, city sales, and full accounting remain future modules.

## Stack and requirements

Next.js App Router, React, TypeScript, Tailwind CSS, Prisma ORM 6, SQLite, Vitest, and Playwright. Use Node.js 22 or 24 LTS and npm. Dependencies are pinned by `package-lock.json`. Prisma 6 keeps local SQLite setup simple without an additional driver adapter. Next development and builds use the supported Webpack builder because Turbopack worker sockets are restricted in this Codespace. A `deepmerge-ts` override selects its patched version for Prisma tooling. Recipe, meal-planning, and shopping features add no dependencies.

## Local setup

From the existing repository root:

```sh
npm ci
cp .env.example .env
npm run db:setup
npm run dev
```

`npm run dev` regenerates Prisma Client before starting Next.js. If a schema update is applied while the development server is already running, stop that server and restart it: Next.js hot reload can retain the previous Prisma client in memory. For an existing database upgrade, run `npm run db:migrate` and then `npm run dev`; no reset or reseeding is needed. An “Unknown field … for include statement” Prisma error after a schema change can indicate this stale running client, even when the generated files on disk are current.

Open http://localhost:3000. In Codespaces, forward port 3000 using the Ports panel. No external services or credentials are required. For an existing checkout with an environment file, retain it instead of overwriting it.

| Variable            | Purpose                                                          | Default/example     |
| ------------------- | ---------------------------------------------------------------- | ------------------- |
| `DATABASE_URL`      | Required local SQLite URL; relative paths resolve from `prisma/` | `file:./dev.db`     |
| `BUSINESS_TIMEZONE` | IANA timezone used for all operation dates                       | `America/Sao_Paulo` |

Invalid timezone configuration fails clearly. Real environment files, databases, generated client, browser artifacts, and build output are ignored. Only `.env.example` is tracked.

## Database and upgrades

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:setup` runs all three commands. Phase 3 adds `20261106020000_recipes_and_meal_plans`: catalog metadata, fixed-point recipe quantities, reusable templates, and restricted operation meal plans. It preserves existing records; do not reset the database to upgrade. For an existing Phase 1 database, the additive `20261106010000_retreat_planning` migration preserves operations and adds optional staff counts, buffer counts, and a fixed 60% retreat staff discount. Existing diner counts retain their meaning. Unknown staff and buffer counts remain null; no attendance is inferred.

Operation seeding inserts missing fictional examples only. Recipe and menu seed additions also preserve existing records and saved plans. Rerunning it **does not overwrite existing operation dates, attendance, statuses, notes, or other operation edits**. The operational seed includes six retreats (four additional fortnightly draft retreats at the same school with unconfirmed counts), three city service days, two private events, three locations, five ingredients, and three original vegan recipes. Phase 3 extends the catalog to eight vegan recipes, 15 ingredients, a three-day retreat template, a smaller city lunch template, a private-event template, and independent example city/event plans. New example dates are relative to the day they are first seeded. Reruns preserve those dates and create no duplicates. Deleted seed examples are reinserted if the seed is run again.

For new schema development, use `npx prisma migrate dev --name descriptive_name` and review the SQL. SQL CHECK constraints and triggers are maintained in migration SQL because Prisma schema syntax cannot express them. Preserve these when rebuilding tables. Do not reset an existing business database to apply upgrades. `npx prisma migrate reset` is only for intentionally disposable development data and deletes all records.

## Operations workflow

- Open **Operations** and choose **New operation**. Enter a name, type, inclusive dates, existing location, and status. Attendance and notes are optional.
- Retreats additionally support full-rate billable participants, expected staff diners, and an additional meal buffer. Blank counts mean unconfirmed; zero means a known zero. Counts can be edited a few days before the retreat without rescheduling it.
- Click an operation name to view details. **Edit operation** updates all fields. Changing to city service or a private event clears retreat-only fields. **Update status** persists Draft, Confirmed, Completed, or Cancelled without changing attendance or other records.
- Switch between **List** and **Calendar**. Type filters and selected month persist between views. The calendar shows operations on every scheduled day, including month boundaries. Use previous/next month or **This month**. On mobile it presents scheduled days and today in an agenda layout.
- **Delete operation** first opens a confirmation section. Permanent deletion requires the explicit checkbox and final confirmation button. **Keep operation** exits without changing data. Cancellation is preferable when history should be retained.
- Edits, status changes, and deletion check the record's last update time. Stale forms show a reload message rather than overwrite a newer change.

OperationMealPlan now references Operation with a restricted foreign key. Purchase and reimbursement history is now protected by restricted foreign keys and immutable financial records. Operations with a saved meal plan cannot be permanently deleted; cancel them to retain history. For operations without a plan, permanent deletion removes only the operation; locations and recipes remain. Review this policy and add restricted deletion or archiving before linking future business records. No cascading operation deletion is implemented. Operation date edits are rejected if they would exclude saved meals. Adjust affected meals within the current dates first; moving an entire saved plan to a disjoint date range is not implemented.

## Attendance, billing, and date rules

- **Expected diners** includes everyone eating, including staff. **Expected staff diners** is a subset of that total and cannot exceed it when both counts are known. Existing Phase 1 totals therefore remain valid.
- **Preparation target = expected diners + additional meal buffer**. An unset buffer contributes zero, but an unknown expected diner count leaves the target unconfirmed. Buffer meals do not create billable participants.
- **Billable participants** means the full-rate group. Staff are a separate billable group receiving a **60% discount**, so staff meals are charged at **40% of the standard service fee**. Staff are not automatically counted again in the full-rate group. Other diners may be unbilled. Rates and financial totals are not implemented in this phase.
- Example: 40 expected diners, including 8 staff, with 30 full-rate participants and a 4-meal buffer produces a preparation target of 44. The 8 staff belong to the discounted billing group; 2 other diners are unbilled. Normal setup does not seed financial transactions; the separate development-only financial seed is described below.
- Scheduling is date-only, from 1900 through 2100, using the configured business timezone. Forms convert each selected date to business-local noon stored as UTC. Existing instants are preserved unless edited. Lists, details, calendar ranges, and upcoming status compare business-local dates, including the entire final day. The end date is inclusive. Changing the timezone after scheduling may change the local dates of existing records; choose it before recording operations.
- Server validation checks names, types, statuses, actual calendar dates, date order, existing locations, whole nonnegative counts, retreat-only fields, staff totals, and notes length. SQLite constraints and triggers provide additional integrity protection, including the fixed retreat staff discount.

## Other domain assumptions

- All food is vegan. Vegan suitability cannot be inferred reliably from free text; future catalog editing must explicitly review ingredients and recipes.
- Retreat ingredients belong to the school and must be organic. City service and private events share business-owned ingredients. Purchases store ownership and a retreat organic-sourcing confirmation; this is an owner attestation, not certification verification.
- Ingredient base units are grams, milliliters, or each. Recipe quantities use integer thousandths of these base units. Forms accept compatible grams/kilograms and milliliters/liters, or individual units. Mass, volume, and count are never converted across dimensions. Recipe and dish portion counts are whole numbers.
- Optional ingredient reference prices are integer BRL centavos per ingredient reference-price unit, representing estimates rather than expenses. Currency formatting is centralized and uses English punctuation (`R$ 150.00`). English labels and date helpers provide a starting point for future Portuguese localization.
- Future finance work must separate school ingredient reimbursements from service revenue, purchases from consumption, and estimated costs from actual expenses. Reimbursements settle receivables rather than count as food sales. Define inventory consumption and expense policy before profitability reporting to avoid double counting.

## Verification

```sh
npm run format:check
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm start
```

On fresh Linux systems, `npx playwright install --with-deps chromium` may be needed with permission to install operating-system packages. `npm run format` formats the source with Prettier.

`npm test` recreates only the dedicated `prisma/test.db`, applies migrations, seeds fixtures, and runs real SQLite integration and domain tests. Tests guard against using the development database. Coverage includes all three operation types, filtering, updates, staff discounts, optional counts, invalid input, stale changes, persisted statuses, confirmed deletion, local-day boundaries, and cross-month calendar ranges.

`npm run test:browser` prepares the same disposable database and builds and starts an isolated Next production server on port 3100 with its own `.next-playwright/` build directory, so an existing development server can stay running. **Do not run the two suites simultaneously.** Browser tests cover the original overview and filters, then create a retreat, inspect and edit it, refresh to verify persistence, locate it across calendar months, change status, cancel a deletion attempt, and explicitly confirm deletion. Validation and mobile layout are also checked. Screenshots and traces are written to ignored `test-results/`.

Production build does not require seed records; operational routes render dynamically. Set up the database before `npm start`. SQLite needs a persistent writable local filesystem.

## Implemented and planned

Implemented: responsive English workspace; database-backed overview; operation creation, details, editing, status changes and confirmed deletion; monthly calendar and type filters; fictional non-overwriting seeds; schema constraints; isolated unit/integration/browser tests; centralized date and BRL formatting; a recipe library, ingredient editing, scaling previews, menu templates, snapshot-based operation meal planning, consolidated requirements, and ownership-separated shopping lists.

Purchase transactions and retreat reimbursements are implemented. Inventory ledgers, city sales, general expense management, and profitability remain planned.

## Known limitations and next steps

This is a local single-owner application. Authentication, authorization, audit history, deployment infrastructure, location editing, recurring-operation rules, pagination, and financial workflows are not implemented. Keep the local server private. Dates do not include meal times or per-day attendance; one operation has one set of expected counts. Staff discount is fixed at 60%, not a configurable financial workflow. New retreat examples are independent editable records, not a recurrence series.

Before shared or hosted use, add access control and audit/history policies. Shopping and planning records now restrict operation deletion. Before adding full purchase transactions or financial records, extend those history-preservation rules. Next product phases can add explicit purchase transactions and reimbursements with ownership separation and auditable costing rules.

## Recipes, ingredients, and scaling

Open **Recipes & Menus** for the searchable recipe library, ingredient catalog, and menu templates. Create or edit a recipe with its standard portion yield, ingredient rows, preparation instructions, optional preparation minutes/category, description, and notes. Recipe details offer portion scaling, duplication, archiving, and restoration. Archived recipes are hidden from active searches and new meal assignments; saved plan snapshots remain readable.

Ingredients use normalized, case-insensitive, whitespace-normalized names to prevent accidental duplicates. The existing English seed names are backfilled during migration. Unicode normalization applies to all new/edit submissions. Ingredient dimensions cannot change when referenced by recipes. Organic and conventional lots share one catalog identity; sourcing remains a later purchasing concern.

While editing a recipe, use the catalog links to create/edit an ingredient in another tab, then **Refresh ingredient list** without losing the current recipe draft. The reference price is optional integer BRL centavos **per selected reference-price unit**, independently of the standard display unit (for example R$ 12.50/kg). Changing either unit clears the form's price and requires explicit re-entry. No costs or purchases are inferred from catalog estimates.

The migration converts original quantities from whole g/mL/each to integer thousandths (`quantityMilli`) while preserving their meaning. Compatible input such as 0.5 kg stores as 500000 thousandths of a gram. Storage precision is 0.001 g/mL/each; more precise input is rejected rather than silently rounded. A single ingredient row supports at most 2,147,483,647 thousandths. Each ingredient appears once in a recipe; combine repeated quantities. All recipes are vegan by business convention and user review; there is no automatic animal-product or dietary analysis.

Scaling is a preview only and uses BigInt rational arithmetic. Desired and standard portions must be whole numbers from 1 through 100,000. Display rounds once to 0.001 base unit and labels inexact results with ≈. The original quantity remains unchanged. Consolidated operation requirements reuse the exact scaling fraction as described below. Full recipe costing and inventory deductions are not implemented.

## Menu templates and operation plans

A template has a name, description, notes, and a schedule of numbered days. Add or remove breakfast, lunch, dinner, and snack meals and assign multiple active recipes to each. Days can have different meal schedules. Templates can be edited or duplicated. Each day has at most one meal of each type; combine its dishes rather than duplicate the meal. Current bounds are 60 template days, 120 meals per schedule, and 20 recipes per meal.

From operation details, choose **Open meal plan**. Either add custom dated meals or apply a template. By default template and operation day counts must match. The explicit **Use only days that fit; leave extra days unplanned** policy trims template meals past the operation end and leaves surplus operation days empty. No meals are created outside the inclusive dates. Replacing an existing plan requires a checkbox confirming that customizations will be replaced.

For retreats, suggested portions are expected diners plus the additional meal buffer. Staff are already included in expected diners and receive the unchanged 60% service-fee discount; planning never modifies billing counts. An unknown or out-of-range suggested quantity leaves portions unconfirmed. City/private-event portions start unconfirmed and are entered independently. Portion counts can differ by meal or dish; blank means unconfirmed. Changing attendance later does not silently rescale an existing plan.

### Snapshot design and historical safety

`MenuTemplate.scheduleJson` is a validated schedule aggregate referencing catalog recipe IDs. `OperationMealPlan.scheduleJson` stores dated meals and complete recipe snapshots (names, yields, instructions, categories, preparation time, notes, and ingredient names, units, quantities, and notes). Both documents are protected by SQLite JSON-validity constraints and strict server-side shape/limit validation. Relational operation ownership is enforced by a unique operation foreign key with restricted deletion.

Applying a template copies its meals and current recipes into snapshots. It does not retain a live template relationship. Editing a recipe, ingredient, or template never rewrites operation plans, regardless of their status. Deliberate plan edits preserve unchanged dish snapshots using plan-owned dish identifiers; client-supplied snapshot contents are ignored. Selecting a replacement recipe takes a fresh snapshot. Previously saved archived recipes can remain in an existing plan, but cannot be assigned as new dishes or used to apply a new template. Duplicate a recipe to make a new library variation when necessary.

Plans are editable only for draft/confirmed operations that have not ended; completed, cancelled, and ended operations are read-only. Saves use the operation update timestamp to reject stale edits. Template and recipe editing also check update timestamps. Saved plan changes touch the operation timestamp so older operation forms cannot overwrite newer planning changes. Plan updates and template application are transactional.

This simple aggregate/snapshot approach avoids a version-control subsystem. JSON recipe references in templates are validated by the service rather than database foreign keys; catalog records are archived, not deleted through the app. Preserve and extend this validation if physical deletion, integrations, or document schema changes are added later. JSON snapshots are intentionally independent of live catalog identities.

### Phase 3 verification coverage

Unit/integration tests use real SQLite to cover ingredient normalization and editing, compatible and incompatible units, fixed-point quantities, recipe CRUD/duplication/archive, deterministic scaling, template editing/duplication, application/customization for all three operation types, explicit day-count handling, immutable snapshots, completed-plan protection, planned-operation deletion/date restrictions, and existing retreat billing rules. Browser tests create a multi-ingredient recipe, reopen and scale it, build a multi-day menu, apply it to a retreat, substitute a dish, refresh the saved plan, and confirm the original template remains unchanged. Ingredient and recipe lifecycle workflows and mobile layouts are included alongside operations regressions.

Browser checks use a production build rather than hot reload to avoid transient compilation changes during mutations. Browser Next.js compilation uses `tsconfig.browser.json` and `.next-playwright/` so generated browser-test route types stay separate from the normal build. Run suites sequentially because they share the disposable test database.

## Seed content and safe copy cleanup

Initial seed records are illustrative, fictional examples for setup and evaluation. They are not verified business operations, menus, transactions, or records of actual customers. Neutral descriptions in the app do not change that provenance; review and adapt the records before using them for business planning. Technical test fixtures may retain explicit fictional labels.

`20261106030000_clean_user_facing_copy` is a data-only migration applied with `npm run db:migrate`. It replaces only exact legacy descriptions and notes on known seed IDs, preserving owner-edited text and all record identities, names, quantities, instructions, dates, statuses, billing counts, and menu schedules. It also cleans exact legacy descriptions inside saved snapshots of known seed recipes, including those copied into other operation plans. Only presentation copy changes in those snapshots; their recipe and meal data remains unchanged. The original seed event's generic meal note is removed only when it still matches exactly. Timestamps are retained. No records are deleted or recreated, and the cleanup is safe to repeat.

New seeds contain the same useful descriptions and omit generic development notes. Do not reset or reseed an existing database just to clean up wording: applying the migration is sufficient. Arbitrary owner-authored text is deliberately not searched and replaced, even if it contains words such as "sample" or "fictional".

## Ingredient requirements and shopping

Phase 4 adds the additive `20261106040000_requirements_and_shopping` migration. Apply it with `npm run db:migrate`; `npm run db:seed` optionally inserts the additional illustrative planning examples. Do not reset the database. Existing operations, recipes, templates, meal plans, and timestamps are preserved.

Open **Ingredients & Shopping** on an operation or use **Purchasing** for lists grouped by operation. Requirements come from the saved recipe snapshots and each dish's planned portions, including recipes repeated across meals/days. Expand sources to inspect contributing dishes. Without a meal plan, the page directs you to plan meals first. Missing portions, yields, ingredient quantities, incompatible units, missing ingredient identities, or totals outside supported bounds produce explicit incomplete-requirement messages. Partial totals are not treated as complete lists; generation/review is blocked until errors are resolved.

### Exact quantities and estimates

The recipe preview and requirements calculator share the exact scaling fraction. The consolidator adds BigInt rational quantities and reduces fractions before rounding **up once per final ingredient total** to 0.001 g/mL/each. It does not sum rounded per-dish previews. Compatible kg/g and L/mL inputs are normalized with the existing unit utilities; mass, volume, and count never silently combine. The calculator currently limits a plan to 20,000 ingredient contributions. Recipe input precision/bounds remain unchanged.

Shopping, available-stock, and substitution quantities store integer thousandths in SQLite BIGINT columns with a maximum of 9,000,000,000,000,000 thousandths, within JavaScript's exact integer range. Forms use decimal strings and reject unsupported precision rather than round user input. Database constraints enforce nonnegative quantities; substitutions require a positive explicit quantity. Units on these records are canonical g/mL/each. Changing an input unit clears its amount, requiring explicit re-entry to avoid reinterpreting the same number under a different unit.

Requirements show optional catalog reference prices per their quoted unit and estimated requirement costs. Shopping items copy an optional price that can be edited independently. Estimated costs use integer arithmetic and round once to BRL centavos per line. Missing prices remain unavailable and make the overall estimate incomplete; they never become zero-cost ingredients. An explicitly entered zero price is distinct from a missing price. These are planning estimates, not expenses, receipts, payments, recipe profitability, or inventory valuation.

### Lists, manual edits, and progress

Generate one shopping list per operation. Initial suggested purchase is `max(required − available estimate, 0)`. If availability is unrecorded, no stock reduction is assumed; it is displayed as **Not recorded**, not verified zero. Review/save individual quantities, supplier/shopping notes, estimated prices and quoted units. Add catalog ingredients manually. A unique list/ingredient constraint prevents duplicate items, including excluded ones.

**Remove from active list** excludes an item without destroying its saved quantity, notes, or progress. Excluded items can be restored. Shopping cards show required quantity and the available estimate at the last review separately from the saved purchase quantity. The progress bar counts active items marked purchased. Printing shows a clean list of saved purchase quantities, notes, progress, ownership, and organic requirements; no edit controls are printed.

Purchased/not purchased tracks shopping progress only. It does not create purchases, financial expenses, reimbursement claims, payments, stock changes, reservations, or ingredient consumption. Shopping-item IDs are stable so a future explicit purchase record can reference them.

### Safe recalculation

A fingerprint captures the meal plan, operation type, substitutions, relevant catalog references, and relevant availability estimates. When these change, the saved list is marked for review. No purchase quantity, price, note, purchased flag, manual addition, or exclusion is silently overwritten. Attendance edits do not automatically rescale saved meals: first deliberately update dish portions in the meal planner.

The review shows old/current required amounts, saved purchase amounts, and new suggestions. **Keep** retains purchase quantities and inclusion status. **Use suggested** changes only the purchase quantity and includes the item. **Leave off** excludes it. New ingredients default to being left off until explicitly selected; removed requirements are shown with required zero while saved manual purchases/progress remain intact. All choices preserve notes and purchased flags. Optional catalog-price checkboxes explicitly replace the saved estimate; they are unchecked by default. Review updates calculated required/available baselines and acknowledges the current source fingerprint. Repeat reviews reuse stable items instead of duplicating them.

Changing a purchased item's quantity does not automatically clear its progress flag; review that flag yourself if additional shopping is needed. Source fingerprints and list timestamps reject stale reviews or concurrent item changes rather than apply outdated suggestions. Existing lists remain usable when a newer meal plan is incomplete, but cannot acknowledge a new requirements baseline until the errors are fixed.

### Explicit substitutions

Operation substitutions replace a named original ingredient with a named catalog ingredient and an **explicit total amount for the entire operation**, not a 1:1 ratio or a per-dish amount. Replacement units must match the replacement ingredient's dimension; an explicit cross-dimension ingredient substitution is allowed because its quantity is entered independently. Original recipes, templates and recipe snapshots remain unchanged. All dishes using the original contribute to the replacement's traceability.

Multiple substitutions apply simultaneously to the original requirements, not recursively as a chain. Their replacement totals combine with any other requirements for the same replacement ingredient. An explicit replacement total stays fixed when dish portions change, so recheck it after menu edits. A substitution whose original ingredient disappears is shown as no longer applicable; it is not silently deleted or applied to unrelated ingredients. Substitutions are editable only under the existing active draft/confirmed meal-plan policy. No suitability recommendations, nutritional equivalence, or automatic replacement quantities are provided.

### Ownership and manually checked availability

Shopping lists store explicit **SCHOOL** or **BUSINESS** ownership and the organic requirement. Retreat lists are school-owned, require organic sourcing, and never read business availability. Their manually recorded available quantities are scoped to that retreat. City service and private events read the same business-owned availability estimates, currently stored at home. Available-stock records also store ownership and scope; database checks/triggers and service validation protect these distinctions. Changing an operation between retreat and business contexts is blocked after shopping or school-availability records exist. Ingredient measurement dimensions cannot change after planning records reference them.

All availability records are manually maintained estimates, not guaranteed inventory and not reservations. Generating lists, reviewing suggestions, or marking purchases never deducts stock. **The same business estimate can inform several overlapping operations**; no allocation is made, so the owner must reconcile shared quantities before shopping. School estimates are separate and also require manual checking; there is no transfer between ownership contexts or stock ledger.

### Illustrative seed additions and verification

The existing third school retreat gains a multi-day plan only if it has none. New records demonstrate an explicit carrot-to-pumpkin substitution, separate school rice availability, shared business rice/carrot estimates, and three operation shopping lists with initial pack-size adjustments. All additions are insert-only, using empty update branches. Shopping adjustments are nested in list creation, never applied to existing items. Rerunning seeds preserves existing plans, substitutions, quantities, notes, purchased flags, exclusions, prices, and availability estimates. These remain illustrative records under the seed-data provenance described above; their values are not verified business stock or actual purchases.

Phase 4 tests cover exact aggregation, rounding, compatible/incompatible units, missing prices and quantities, explicit substitutions, recipe/template preservation, shopping persistence and recalculation, manual additions, removed requirements, exclusions, progress, ownership separation, stock estimates, stale updates, duplicate prevention, and seed rerun safety. The browser workflow generates a retreat list, edits and purchases an item on mobile, updates dish portions, reviews differences while retaining manual edits, records school availability, makes a substitution, checks business stock separation, and exercises print layout. Existing recipe/menu/operations workflows continue to run.

Phase 5 adds purchases, receipt references and reimbursements below. Automatic deductions, stock reservations, supplier integrations, nutritional analysis, profitability reporting, and forecasting remain outside scope. There is one list per operation and no list-deletion UI; exclusion preserves item history. Requirements currently calculate in memory, so large operations may need future query/pagination work within the documented bounds.

## Brazilian reference prices

`20261106050000_reference_price_units` adds a separate `Ingredient.referencePriceUnit`. Existing manually entered prices keep their amounts, and their old display unit is backfilled as the quote unit. Recipe quantities, ingredient base/display units, shopping quantities, progress, notes, and saved shopping prices are not changed.

For an existing local database:

```sh
npm run db:migrate
npm run db:reference-prices
```

Restart a running development server after the schema/client update. New installations receive the prices through the normal `npm run db:setup` seed flow. The dedicated updater does not create or recreate ingredients and fills only null prices on matching normalized ingredient names and compatible base units. Existing manually entered amounts, including zero, are preserved. Repeating the update makes no further changes unless a matching price has subsequently been cleared to null.

These approximate Brazilian supermarket retail references were supplied in the project request; no listing URLs or independent market-verification date were provided. They are estimates for testing/planning, not verified current supplier quotations, actual purchase amounts, or organic sourcing guarantees. Confirm applicable organic prices for retreat purchasing.

| Ingredient               | Supplied reference | Stored exact quote               |
| ------------------------ | ------------------ | -------------------------------- |
| Bananas                  | R$ 8.00/kg         | 800 centavos per kg              |
| Brown rice               | R$ 7.50/kg         | 750 centavos per kg              |
| Carrots                  | R$ 6.50/kg         | 650 centavos per kg              |
| Dry chickpeas            | R$ 23.00/kg        | 2300 centavos per kg             |
| Dry green lentils        | R$ 22.00/kg        | 2200 centavos per kg             |
| Oranges                  | R$ 5.00/kg         | 500 centavos per kg              |
| Pumpkin                  | R$ 6.00/kg         | 600 centavos per kg              |
| Unsweetened coconut milk | R$ 8.00/200 mL     | 4000 centavos per L (R$ 40.00/L) |

Existing catalog entries named Chickpeas and Green lentils represent the dry ingredients; their names and recipe quantities remain intact.

The expanded catalog uses the following rounded **development estimates**, selected on 2026-11-06 as plausible Brazilian retail planning values, rather than exact current offers. All 15 currently seeded ingredients now have compatible reference quotes. The original eight supplied values above are unchanged.

| Additional ingredient | Estimated reference | Assumption                                                                                                                         |
| --------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Lemons                | R$ 2.00/each        | Whole Tahiti-style fruit; catalog recipes count fruit, not juice volume or weight.                                                 |
| Olive oil             | R$ 60.00/L          | Approximately R$ 30.00 per 500 mL retail bottle.                                                                                   |
| Rolled oats           | R$ 20.00/kg         | Approximately R$ 10.00 per 500 g pack.                                                                                             |
| Spinach               | R$ 30.00/kg         | Approximately R$ 9.00 per 300 g retail pack; mass of usable spinach, not bunch count.                                              |
| Tomatoes              | R$ 12.00/kg         | Ordinary fresh tomatoes; variety and season unspecified.                                                                           |
| Unsweetened cocoa     | R$ 200.00/kg        | Approximately R$ 40.00 per 200 g pack of 100% cocoa, not sweetened chocolate powder.                                               |
| Water                 | R$ 2.00/L           | Bottled still drinking water for this testing estimate; not a municipal tariff or a claim about the kitchen's actual water source. |

Retail context consulted: [Pão de Açúcar lemons](https://www.paodeacucar.com/especial/especialverao-drinks), [Carrefour oats and olive oil](https://mercado.carrefour.com.br/colecao/24522/score-desc/0?page=3), [Pão de Açúcar spinach](https://www.paodeacucar.com/produto/672780/espinafre-congelado-picado-higienizado-taeq-pacote-300g), [tomato retail context](https://www.rappi.com.br/lojas/900652964-pao-de-azucar-superfresh-nc/ofertas), [Carrefour 100% cocoa](https://mercado.carrefour.com.br/colecao/26750/score-desc/0?page=8), and [Pão de Açúcar drinking water](https://www.paodeacucar.com/produto/20780/especial). Listings vary by region, pack, promotion and date; the rounded estimates are deliberate test inputs and are not supplier quotations, organic premiums, or verified business costs.

The updater matches names and measurement dimensions explicitly. Unrecognized names or incompatible units remain unset and are reported by name, rather than receiving a generic price. Owner-added ingredients in future require an explicit reference or manual entry. Existing prices always take priority, even if they differ from this table.

Whole quote units avoid rounding fractional centavos per gram. For example rice stores R$ 7.50/kg, retaining the exact equivalent R$ 0.0075/g; chickpeas retain R$ 0.023/g. Coconut milk's R$ 40.00/L quote retains exactly R$ 0.04/mL. Costs multiply integer thousandths by integer quoted centavos and divide using BigInt arithmetic, rounding only the final ingredient-line amount to centavos. Recipe previews price the exact portion-scaling fraction without first rounding displayed quantities.

Recipe ingredient previews show available line estimates and a complete total or an explicitly incomplete priced-ingredients subtotal. Shopping cards use saved list-specific quotes first. If a saved price is null, the current catalog reference can provide a labeled **Catalog reference** estimate without writing that reference into the shopping item. These fallback estimates may change as catalog references change; saved quotes and historical amounts remain intact. Enter a list-specific price to retain a particular quote. Optional price-review choices can explicitly copy a catalog price into the saved list, as before.

The shopping summary totals active planned purchase quantities, distinguishes priced items from items with unavailable prices, and never labels a partial subtotal as a complete total. Missing prices stay unavailable, even when other lines have known zero prices. Editing a planned quantity recalculates its estimate. Reference quotes remain editable through Ingredients, with separate measurement and price-unit controls. Ingredient references exclude labor and other expenses; they create no expenses, reimbursements, payments, or purchase transactions.

## Phase 5: actual purchases and school reimbursements

Apply the additive `20261106060000_purchase_transactions` migration with `npm run db:migrate`, regenerate the client with `npm run db:generate`, and restart any running server. Existing operations, recipes, catalog quotes, shopping quantities, adjustments, checkmarks and notes are preserved. No existing plan or estimate is converted into a financial transaction.

Purchasing now includes purchase history with operation/funding filters, a new purchase form, purchase details, editable supplier/notes/receipt references, and retreat reimbursement tracking. Operation details link to purchases and show their histories. Retreat details show school-funded purchase totals, school-direct payments, reimbursement allocations received, and the amount still owed to the owner. Reimbursement dates use the configured business timezone, as do purchase dates.

### Recording actual ingredients

Record multiple ingredient lines for an operation or shared business purchasing. A retreat requires School funding, Owner paid or School paid directly, and confirmation of organic sourcing. City service, private events and shared purchases require Business funding with Owner paid or Business paid. Only owner-paid school purchases create school reimbursement balances. Payment source is who actually paid, distinct from who ultimately bears the ingredient cost.

Start from a shopping list to copy planned quantities, then explicitly enter actual paid prices and confirm the quantities. Each item can optionally use the current catalog reference as a starting estimate. Actual quoted prices, quoted units, base-unit quantities, ingredient names and rounded line amounts are saved independently; catalog edits do not rewrite purchase history. Duplicate ingredients must be consolidated into one line per purchase. Multiple purchases may cover the same ingredient/list over time.

Quantities retain integer thousandths of g/mL/each, using the existing exact kg/g and L/mL conversions. Positive quantities up to 9,000,000,000,000,000 thousandths are supported. Prices are nonnegative integer BRL centavos per the selected compatible quote unit (use kg/L to avoid tiny fractional-cent values); actual line costs use BigInt multiplication/division and round once per line. The purchase total sums those rounded actual line amounts. Prices, line totals, purchase totals and individual reimbursement totals are bounded at 2,147,483,647 centavos. Zero-value purchases are allowed, but cannot receive a positive reimbursement. Negative amounts, excess precision and incompatible units are rejected rather than coerced. Discounts should be reflected in the paid ingredient unit prices; separate freight, taxes, miscellaneous fees and invoice rounding adjustments are not modeled yet.

A receipt reference is plain text, such as a receipt number or a reference to a separately stored file. There is no upload or document storage service. Financial forms retain controlled input values on validation errors and disable repeated submission while pending. The displayed totals are previews; server-side validation and calculations remain authoritative.

### Planned versus purchased

Linked shopping lists show planned and actual acquired quantities separately, using only purchases explicitly linked to that list. Actual acquisitions are aggregated across its purchases; unlinked operation purchases remain in purchase history. Recording a purchase does not change the planned quantity, shopping task checkmarks, availability estimates, stock, ingredient consumption, or expense/profitability ledgers. A shopping checkmark remains a task-progress flag, not evidence of a purchase. Financial records restrict deletion of their referenced operation, ingredient, list and shopping item; excluding an item continues to preserve its history.

### Allocating reimbursements safely

The reimbursements screen lists eligible outstanding owner-paid school purchases. Enter an amount beside each purchase covered by the payment; leave unrelated purchases blank. The payment total is exactly the sum of its positive allocations, not an independently editable revenue amount. One payment can span several purchases or retreats. Each allocation is unique within its payment, cannot exceed the purchase's remaining eligible balance, and cannot predate the purchase. Business-funded and school-direct purchases are rejected on the server even if submitted outside the form.

Balances and statuses are derived from allocations: Pending, Partially reimbursed, or Reimbursed. A school-direct purchase is Not eligible and has no owner reimbursement balance. Filtered histories show the portion of a payment allocated to the purchases in that view, so a payment spanning retreats is not counted in full twice. Reimbursements are cash repayment of ingredient outlays, never ordinary food sales or retreat service-fee revenue. This phase does not calculate service fees or retreat profitability.

Creation and allocation use database transactions. Purchase and reimbursement submission IDs have payload fingerprints: an identical retry returns its existing record; reusing a token for different values is rejected. SQLite triggers independently prevent ineligible/excess allocations, edits/deletions of financial amounts, changes of recorded operation context, and sealing a purchase/payment whose total differs from its items/allocations. Unique constraints prevent duplicate ingredient lines and duplicate allocations. Concurrent writers may receive a safe retry/reload error from SQLite; partially written records roll back. Financial histories cannot be removed through operation deletion or ownership/type changes. Cancellation remains available.

Only supplier, notes and receipt reference can be edited on recorded purchases, using optimistic timestamp checks. Amounts, items, dates, funding, payment source and allocations are immutable. **Correction/reversal and refund workflows are not implemented yet**: verify before recording; do not bypass the history protections to correct financial mistakes. There is no financial deletion UI. Metadata changes update the timestamp but do not yet have a full audit log. As with earlier phases, this is a local owner workspace without authentication; access control and audited correction flows are prerequisites for shared/hosted production use.

### Optional financial examples — development only

Normal migrations, `db:setup`, `db:seed`, production builds and `npm start` do not create purchase/reimbursement examples. To explicitly add illustrative financial records to a disposable/development workspace after the operational seed:

```sh
npm run db:seed:financial
```

The runner requires its explicit development flag and rejects `NODE_ENV=production`. Never run the example seed against a real business database. There are five illustrative purchases: two for the first retreat (R$ 68.00 combined with R$ 28.00 reimbursed and R$ 40.00 outstanding), one fully reimbursed second-retreat purchase (R$ 48.00), a city purchase (R$ 67.50), and shared business oats (R$ 20.00). These are testing records, not verified business transactions. Neutral UI descriptions do not alter this provenance. Existing IDs are skipped; reruns do not rewrite any financial values or metadata. If existing example operation types/ingredients have been changed incompatibly, the script fails safely rather than rewriting them; previously completed examples remain and can be skipped on retry.

### Phase 5 verification

Financial integration tests use the disposable test database and cover actual prices and fixed-point conversions, totals, persistence, reference-price independence, idempotent submissions, ownership/payment-source eligibility, partial/full and multi-purchase reimbursements, over-allocation and duplicate rejection, backdating, rollback, metadata conflicts, immutable history, shopping-plan preservation, and repeatable optional examples. The browser workflow records a retreat purchase, verifies history and outstanding balances, receives partial and final payments, refreshes to verify persistence, checks validation input retention, and confirms business purchases never appear in school reimbursement allocations. Existing operation, recipe, menu and shopping workflows remain covered by the full browser suite. Run the commands in Verification above; both suites isolate their data from the development database.
