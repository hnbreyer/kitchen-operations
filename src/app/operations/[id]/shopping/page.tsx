import Link from "next/link";
import { ActualProgress } from "@/components/purchasing/actual-progress";
import { notFound } from "next/navigation";
import { shoppingQuote, summarizeCosts } from "@/lib/menus/pricing";
import { getPurchasingContext } from "@/lib/purchasing/context";
import {
  estimatedCost,
  calculateRequirements,
} from "@/lib/purchasing/requirements";
import { decimalString, units, type Unit } from "@/lib/menus/quantities";
import { formatDate, formatMoney } from "@/lib/config";
import { editablePlan } from "@/lib/menus/planning";
import { ActionButton } from "@/components/menus/shared";
import {
  ShoppingItemForm,
  ShoppingReview,
  StockForm,
  SubstitutionForm,
  PrintShoppingList,
  type ReviewRow,
} from "@/components/purchasing/forms";
import {
  generateAction,
  progressAction,
  substitutionAction,
} from "@/app/purchasing/actions";
export const dynamic = "force-dynamic";
const quantity = (n: number | bigint) => decimalString(BigInt(n));
export default async function ShoppingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; review?: string }>;
}) {
  const { id } = await params,
    context = await getPurchasingContext(id);
  if (!context) notFound();
  const { notice, review } = await searchParams;
  const {
      operation,
      requirements,
      policy,
      catalog,
      stock,
      substitutions,
      fingerprint,
    } = context,
    list = operation.shoppingList;
  const options = catalog.map((i) => ({
    id: i.id,
    name: i.name,
    baseUnit: i.baseUnit,
  }));
  const active = list?.items.filter((i) => !i.excluded) ?? [],
    purchased = active.filter((i) => i.purchased).length;
  const itemPrices = new Map(
    active.map((item) => {
      const ingredient = catalog.find((i) => i.id === item.ingredientId);
      const quote = shoppingQuote(
        item.estimatedPriceCentavos,
        item.priceUnit,
        ingredient ?? {
          baseUnit: item.unit,
          displayUnit: item.unit,
          referencePriceCentavos: null,
        },
      );
      return [
        item.id,
        {
          ...quote,
          cost: estimatedCost(
            Number(item.plannedMilli),
            item.unit,
            quote.price,
            quote.unit,
          ),
        },
      ];
    }),
  );
  const shoppingCosts = summarizeCosts(
    active.map((item) => itemPrices.get(item.id)!.cost),
  );
  const totalCosts = requirements.map((r) => r.estimatedCostCentavos),
    knownCost = totalCosts.reduce<number>((sum, n) => sum + (n ?? 0), 0),
    incomplete =
      totalCosts.some((n) => n == null) ||
      context.issues.length > 0 ||
      !Number.isSafeInteger(knownCost);
  const reviewIds = [
    ...new Set([
      ...requirements.map((r) => r.ingredientId),
      ...(list?.items.map((i) => i.ingredientId) ?? []),
    ]),
  ];
  const reviewRows: ReviewRow[] = reviewIds.map((ingredientId) => {
    const r = requirements.find((r) => r.ingredientId === ingredientId),
      old = list?.items.find((i) => i.ingredientId === ingredientId);
    return {
      ingredientId,
      name: r?.name ?? old!.ingredientName,
      oldRequired: old ? Number(old.requiredMilli) : null,
      required: r?.requiredMilli ?? 0,
      oldPlanned: old ? Number(old.plannedMilli) : null,
      suggested: r?.suggestedMilli ?? 0,
      unit: r?.unit ?? old!.unit,
      excluded: old?.excluded ?? false,
      purchased: old?.purchased ?? false,
      manual: old?.manual ?? false,
      priceChanged:
        !!old &&
        (old.estimatedPriceCentavos !== (r?.priceCentavos ?? null) ||
          old.priceUnit !== (r?.priceUnit ?? null)),
    };
  });
  const originals = calculateRequirements(context.meals, catalog).requirements;
  const originalIds = [
    ...new Set([
      ...originals.map((r) => r.ingredientId),
      ...substitutions.map((s) => s.originalIngredientId),
    ]),
  ];
  const noticeText: Record<string, string> = {
    generated: "Shopping list generated.",
    saved: "Shopping item saved.",
    progress: "Shopping progress updated.",
    reviewed:
      "Reviewed requirements applied. Manual edits and purchase progress were preserved.",
    stock: "Availability estimate saved. Review your shopping suggestions.",
    substitution: "Operation substitution saved. Review your shopping list.",
  };
  return (
    <>
      {list && <ActualProgress listId={list.id} />}
      <div className="shopping-screen no-print">
        <Link href={`/operations/${id}`} className="text-link">
          ← Back to operation
        </Link>
        <div className="page-heading">
          <div>
            <p className="eyebrow">INGREDIENTS AND SHOPPING</p>
            <h1>Ingredients & Shopping</h1>
            <p>
              {operation.name} · {formatDate(operation.startDate)} –{" "}
              {formatDate(operation.endDate)}
            </p>
          </div>
          <Link className="secondary-button" href={`/operations/${id}/meals`}>
            Edit meal plan
          </Link>
        </div>
        {notice && noticeText[notice] && (
          <p role="status" className="success-message">
            {noticeText[notice]}
          </p>
        )}
        <section className="info-strip ownership-banner">
          <div>
            <strong>
              {policy.inventoryOwner === "SCHOOL"
                ? "School-owned purchasing · Organic sourcing required"
                : "Business-owned purchasing · Shared with city service and private events"}
            </strong>
            <p>
              {policy.inventoryOwner === "SCHOOL"
                ? "Retreat ingredients belong to the school. Business stock is never used in these suggestions."
                : "Availability is a manually maintained estimate of business stock, currently stored at home. Stock is not reserved across operations; verify quantities before shopping."}
            </p>
            <p>
              Purchased checkmarks track shopping progress only. They do not
              create expenses, reimbursements, payments, stock movements, or
              consumption.
            </p>
          </div>
        </section>
        {!operation.mealPlan ? (
          <section className="panel empty">
            <h2>Plan meals first</h2>
            <p>Add recipes and planned portions to calculate ingredients.</p>
            <Link className="button" href={`/operations/${id}/meals`}>
              Open meal plan
            </Link>
          </section>
        ) : (
          <>
            <section className="panel detail-section">
              <h2>Consolidated requirements</h2>
              <p className="field-hint">
                Exact recipe fractions are combined before rounding up once to
                0.001 g, mL, or each. Available stock is an estimate; suggested
                purchase is required minus available, never below zero.
              </p>
              {context.issues.length > 0 && (
                <div className="form-alert" role="alert">
                  <strong>
                    Requirements are incomplete. Partial totals below do not
                    cover every dish.
                  </strong>
                  <ul>
                    {context.issues.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                  <p>
                    Confirm portions or correct the saved meal plan before
                    generating or updating requirements.
                  </p>
                </div>
              )}
              {context.warnings.map((w) => (
                <p className="field-hint" key={w}>
                  {w}
                </p>
              ))}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Required</th>
                      <th>Available estimate</th>
                      <th>Suggested purchase</th>
                      <th>Reference price</th>
                      <th>Estimated requirement cost</th>
                      <th>Sources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((r) => (
                      <tr key={r.ingredientId}>
                        <td>{r.name}</td>
                        <td>
                          {r.approximate ? "≈ " : ""}
                          {quantity(r.requiredMilli)} {units[r.unit].label}
                        </td>
                        <td>
                          {r.availableMilli == null
                            ? "Not recorded"
                            : `${quantity(r.availableMilli)} ${units[r.unit].label}`}
                        </td>
                        <td>
                          {quantity(r.suggestedMilli)} {units[r.unit].label}
                        </td>
                        <td>
                          {r.priceCentavos == null || !r.priceUnit
                            ? "Not available"
                            : `${formatMoney(r.priceCentavos)} / ${units[r.priceUnit as Unit].label}`}
                        </td>
                        <td>
                          {r.estimatedCostCentavos == null
                            ? "Not available"
                            : formatMoney(r.estimatedCostCentavos)}
                        </td>
                        <td>
                          <details>
                            <summary>
                              {
                                new Set(r.contributions.map((c) => c.dishKey))
                                  .size
                              }{" "}
                              dishes
                            </summary>
                            <ul className="requirement-sources">
                              {r.contributions.map((c, index) => (
                                <li key={index}>
                                  {c.label}
                                  {c.substitutedFrom
                                    ? ` · replaces ${c.substitutedFrom}`
                                    : ""}
                                  <br />
                                  {c.quantity}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="footnote">
                {incomplete
                  ? `Estimate incomplete${Number.isSafeInteger(knownCost) && totalCosts.some((cost) => cost != null) ? ` · Priced ingredients subtotal ${formatMoney(knownCost)}` : ""}. Missing prices are not zero-cost ingredients.`
                  : `Estimated ingredient requirement cost: ${formatMoney(knownCost)}`}
              </p>
            </section>
            {list ? (
              <>
                <section className="panel detail-section">
                  <div className="section-heading shopping-heading">
                    <div>
                      <h2>Shopping list</h2>
                      <p>
                        {purchased} of {active.length} items marked purchased
                      </p>
                    </div>
                    <PrintShoppingList />
                  </div>
                  {context.stale ? (
                    <div className="form-alert" role="status">
                      <strong>
                        Requirements changed since this list was reviewed.
                      </strong>
                      <p>
                        Your quantities, notes, and purchased flags have not
                        been overwritten.
                      </p>
                      <Link
                        className="text-link"
                        href={`/operations/${id}/shopping?review=yes#review`}
                      >
                        Review requirement changes
                      </Link>
                    </div>
                  ) : (
                    <p className="field-hint">
                      Reviewed against the current plan and availability
                      estimates. Shopping quantities remain your saved choices.
                    </p>
                  )}
                  <progress
                    value={purchased}
                    max={Math.max(active.length, 1)}
                    aria-label="Shopping progress"
                  />
                  <p className="shopping-cost-summary">
                    {shoppingCosts.totalCentavos != null
                      ? `Estimated shopping total: ${formatMoney(shoppingCosts.totalCentavos)} · ${shoppingCosts.pricedCount} priced items`
                      : shoppingCosts.subtotalCentavos == null
                        ? "Shopping estimate exceeds the supported range."
                        : shoppingCosts.pricedCount
                          ? `Priced items subtotal: ${formatMoney(shoppingCosts.subtotalCentavos)} · ${shoppingCosts.pricedCount} priced items · ${shoppingCosts.unknownCount} items without available prices. Total incomplete.`
                          : `Shopping estimate unavailable · ${shoppingCosts.unknownCount} items without available prices.`}
                  </p>
                  <p className="field-hint">
                    List-specific prices take priority. Blank prices use current
                    catalog references for estimates only; saved shopping values
                    are not changed.
                  </p>
                  <p className="field-hint">
                    Shopping quantities and estimated prices are editable.
                    Available quantities are not deducted by these actions.
                  </p>
                </section>
                {(review === "yes" || context.stale) &&
                  context.issues.length === 0 && (
                    <ShoppingReview
                      key={`${list.updatedAt.toISOString()}-${fingerprint}`}
                      operationId={id}
                      version={list.updatedAt.toISOString()}
                      fingerprint={fingerprint}
                      rows={reviewRows}
                    />
                  )}
                <div className="shopping-items">
                  {active.map((item) => {
                    const quote = itemPrices.get(item.id)!;
                    const cost = quote.cost;
                    return (
                      <article
                        className={`panel shopping-card ${item.purchased ? "is-purchased" : ""}`}
                        key={item.id}
                        aria-label={`Shopping item ${item.ingredientName}`}
                      >
                        <div className="shopping-card-heading">
                          <h3>{item.ingredientName}</h3>
                          <span className="subtle-tag">
                            {item.purchased ? "Purchased" : "To buy"}
                          </span>
                        </div>
                        <p className="shopping-quantity">
                          {quantity(item.plannedMilli)} {units[item.unit].label}{" "}
                          <small>planned purchase</small>
                        </p>
                        <p className="field-hint">
                          Required at last review:{" "}
                          {quantity(item.requiredMilli)}{" "}
                          {units[item.unit].label} · Available then:{" "}
                          {item.availableMilli == null
                            ? "not recorded"
                            : `${quantity(item.availableMilli)} ${units[item.unit].label}`}
                          {item.manual ? " · Manual addition" : ""}
                        </p>
                        <p className="field-hint">
                          Estimated purchase cost:{" "}
                          {cost == null ? "Not available" : formatMoney(cost)}
                        </p>
                        {quote.price != null && quote.unit && (
                          <p className="field-hint">
                            {quote.source === "catalog"
                              ? "Catalog reference"
                              : "List-specific estimate"}
                            : {formatMoney(quote.price)} /{" "}
                            {units[quote.unit as Unit].label}
                          </p>
                        )}
                        {item.notes && (
                          <p className="preserve-lines">{item.notes}</p>
                        )}
                        <div className="form-actions">
                          <ActionButton
                            key={`progress-${list.updatedAt.toISOString()}`}
                            action={progressAction.bind(
                              null,
                              id,
                              list.updatedAt.toISOString(),
                              item.id,
                              "purchased",
                            )}
                            label={
                              item.purchased
                                ? "Mark not purchased"
                                : "Mark purchased"
                            }
                            className="button"
                          />
                          <ActionButton
                            key={`exclude-${list.updatedAt.toISOString()}`}
                            action={progressAction.bind(
                              null,
                              id,
                              list.updatedAt.toISOString(),
                              item.id,
                              "exclude",
                            )}
                            label="Remove from active list"
                          />
                        </div>
                        <details className="shopping-details">
                          <summary>
                            Edit purchase quantity, price, or notes
                          </summary>
                          <ShoppingItemForm
                            key={`${item.id}-${list.updatedAt.toISOString()}`}
                            operationId={id}
                            version={list.updatedAt.toISOString()}
                            catalog={options}
                            item={{
                              id: item.id,
                              ingredientId: item.ingredientId,
                              unit: item.unit,
                              plannedMilli: Number(item.plannedMilli),
                              price: item.estimatedPriceCentavos,
                              referenceUnit: quote.unit,
                              priceUnit: item.priceUnit,
                              notes: item.notes ?? "",
                              purchased: item.purchased,
                            }}
                          />
                        </details>
                      </article>
                    );
                  })}
                </div>
                {!active.length && (
                  <p className="panel empty">
                    No active shopping items. Add an item or restore an excluded
                    item.
                  </p>
                )}
                <section className="panel detail-section">
                  <h2>Manual addition</h2>
                  <p className="field-hint">
                    Select a catalog ingredient. An existing or excluded
                    ingredient is edited or restored instead of duplicated.
                  </p>
                  <ShoppingItemForm
                    key={`new-${list.updatedAt.toISOString()}`}
                    operationId={id}
                    version={list.updatedAt.toISOString()}
                    catalog={options}
                  />
                </section>
                {list.items.some((i) => i.excluded) && (
                  <section className="panel detail-section">
                    <h2>Excluded items</h2>
                    {list.items
                      .filter((i) => i.excluded)
                      .map((item) => (
                        <div key={item.id} className="excluded-item">
                          <span>
                            {item.ingredientName} ·{" "}
                            {quantity(item.plannedMilli)}{" "}
                            {units[item.unit].label}
                            {item.purchased ? " · Purchased" : ""}
                          </span>
                          <ActionButton
                            action={progressAction.bind(
                              null,
                              id,
                              list.updatedAt.toISOString(),
                              item.id,
                              "exclude",
                            )}
                            label={`Restore ${item.ingredientName}`}
                          />
                        </div>
                      ))}
                  </section>
                )}
              </>
            ) : (
              <section className="panel detail-section">
                <h2>Build your shopping list</h2>
                <p>
                  Start with the current requirements and availability
                  estimates, then adjust purchase quantities and shopping notes.
                </p>
                {context.issues.length === 0 && requirements.length > 0 ? (
                  <ActionButton
                    action={generateAction.bind(null, id, fingerprint)}
                    label="Generate shopping list"
                    className="button"
                  />
                ) : (
                  <p>Resolve the missing meal quantities first.</p>
                )}
              </section>
            )}
            <section className="panel detail-section">
              <h2>Available quantities</h2>
              <p>
                {policy.inventoryOwner === "SCHOOL"
                  ? "Record school-owned quantities available for this retreat only. No business stock is included."
                  : "Record manually checked business stock. These shared estimates do not reserve stock, and several operations may rely on the same quantity."}
              </p>
              <p className="field-hint">
                An unrecorded quantity is not a verified zero. Suggestions use
                no stock reduction until an estimate is entered.
              </p>
              {requirements.map((r) => {
                const current = stock.find(
                  (s) => s.ingredientId === r.ingredientId,
                );
                return (
                  <details className="stock-editor" key={r.ingredientId}>
                    <summary>
                      {r.name} ·{" "}
                      {current
                        ? `${quantity(current.quantityMilli)} ${units[current.unit].label} available estimate`
                        : "Not recorded"}
                    </summary>
                    <StockForm
                      key={current?.updatedAt.toISOString() ?? "new"}
                      operationId={id}
                      ingredientId={r.ingredientId}
                      version={current?.updatedAt.toISOString() ?? null}
                      base={r.unit}
                      initial={current ? Number(current.quantityMilli) : null}
                      notes={current?.notes ?? ""}
                      ownership={policy.inventoryOwner}
                    />
                  </details>
                );
              })}
            </section>
            <section className="panel detail-section">
              <h2>Operation-specific substitutions</h2>
              <p>
                Replace ingredients for this operation without editing recipes
                or reusable menus. Each substitution is an explicit total across
                all dishes using the original ingredient. If several
                substitutions are made, they apply to the original requirements
                simultaneously, not as a chain.
              </p>
              {policy.organicRequired && (
                <p className="field-hint">
                  All replacement ingredients for this retreat must also be
                  organically sourced.
                </p>
              )}
              {originalIds.map((originalId) => {
                const existing = substitutions.find(
                    (s) => s.originalIngredientId === originalId,
                  ),
                  original = originals.find(
                    (r) => r.ingredientId === originalId,
                  );
                return (
                  <details className="stock-editor" key={originalId}>
                    <summary>
                      {existing
                        ? `${existing.originalIngredient.name} → ${existing.replacementIngredient.name} · ${quantity(existing.quantityMilli)} ${units[existing.unit].label} total`
                        : (original?.name ?? originalId)}
                      {!original ? " · No longer used by current meals" : ""}
                    </summary>
                    {editablePlan(operation) ? (
                      <>
                        <SubstitutionForm
                          key={`${operation.updatedAt.toISOString()}-${existing?.id ?? "new"}`}
                          operationId={id}
                          version={operation.updatedAt.toISOString()}
                          originalIngredientId={originalId}
                          catalog={options}
                          initial={
                            existing
                              ? {
                                  replacementIngredientId:
                                    existing.replacementIngredientId,
                                  quantityMilli: Number(existing.quantityMilli),
                                  unit: existing.unit,
                                  notes: existing.notes ?? "",
                                }
                              : undefined
                          }
                        />
                        {existing && (
                          <ActionButton
                            action={substitutionAction.bind(
                              null,
                              id,
                              operation.updatedAt.toISOString(),
                              originalId,
                              true,
                            )}
                            label="Remove substitution"
                          />
                        )}
                      </>
                    ) : (
                      <p>
                        Substitutions are read-only for ended, cancelled, or
                        completed operations.
                      </p>
                    )}
                  </details>
                );
              })}
            </section>
          </>
        )}
      </div>
      {list && (
        <section className="print-only">
          <h1>{operation.name} — Shopping list</h1>
          <p>
            {formatDate(operation.startDate)} – {formatDate(operation.endDate)}{" "}
            ·{" "}
            {policy.inventoryOwner === "SCHOOL"
              ? "School-owned · Organic required"
              : "Business-owned"}
          </p>
          <p>
            {purchased}/{active.length} purchased · Shopping progress only, not
            an expense record.
          </p>
          <table>
            <thead>
              <tr>
                <th>Purchased</th>
                <th>Ingredient</th>
                <th>Purchase quantity</th>
                <th>Shopping notes</th>
              </tr>
            </thead>
            <tbody>
              {active.map((item) => (
                <tr key={item.id}>
                  <td>{item.purchased ? "Yes" : "No"}</td>
                  <td>{item.ingredientName}</td>
                  <td>
                    {quantity(item.plannedMilli)} {units[item.unit].label}
                  </td>
                  <td>{item.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {context.stale && (
            <p>Requirements changed; review this list before shopping.</p>
          )}
        </section>
      )}
    </>
  );
}
