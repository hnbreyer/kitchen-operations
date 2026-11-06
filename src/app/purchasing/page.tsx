import Link from "next/link";
import { purchaseInclude } from "@/lib/purchasing/transactions";
import {
  PurchaseHistory,
  PurchaseSummary,
} from "@/components/purchasing/purchase-history";
import { db } from "@/lib/db";
import { sourcingPolicy, typeLabels, statusLabels } from "@/lib/domain";
import { formatDate } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Purchasing({
  searchParams,
}: {
  searchParams: Promise<{ operation?: string; funding?: string }>;
}) {
  const query = await searchParams;
  const purchases = await db.purchase.findMany({
    where: {
      finalized: true,
      ...(query.operation ? { operationId: query.operation } : {}),
      ...(["SCHOOL", "BUSINESS"].includes(query.funding ?? "")
        ? { funding: query.funding as "SCHOOL" | "BUSINESS" }
        : {}),
    },
    include: purchaseInclude,
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });
  const operations = await db.operation.findMany({
    orderBy: { startDate: "asc" },
    include: {
      location: true,
      mealPlan: { select: { id: true } },
      shoppingList: {
        include: { items: { select: { excluded: true, purchased: true } } },
      },
    },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAN THE SHOPPING AHEAD</p>
          <h1>Purchasing</h1>
          <p>
            Plan shopping, record actual purchases, and track school
            reimbursements.
          </p>
        </div>
      </div>
      <div className="form-actions">
        <Link className="button" href="/purchasing/new">
          New purchase
        </Link>
        <Link className="secondary-button" href="/purchasing/reimbursements">
          Retreat reimbursements
        </Link>
      </div>
      <section className="panel detail-section">
        <h2>Purchase history</h2>
        <form className="form-grid" method="get">
          <div className="field">
            <label htmlFor="filter-operation">Filter by operation</label>
            <select
              name="operation"
              id="filter-operation"
              defaultValue={query.operation ?? ""}
            >
              <option value="">All operations and shared purchases</option>
              {operations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-funding">Filter by funding</label>
            <select
              name="funding"
              id="filter-funding"
              defaultValue={query.funding ?? ""}
            >
              <option value="">All funding</option>
              <option value="SCHOOL">School</option>
              <option value="BUSINESS">Business</option>
            </select>
          </div>
          <div className="form-actions">
            <button className="button">Apply purchase filters</button>
            <Link className="text-link" href="/purchasing">
              Clear filters
            </Link>
          </div>
        </form>
        <PurchaseSummary purchases={purchases} />
        <PurchaseHistory purchases={purchases} />
      </section>
      <h2>Shopping by operation</h2>
      <div className="info-strip">
        <p>
          Retreat purchases are school-owned and must be organic. City service
          and private events share business-owned ingredients. Shopping
          checkmarks do not record expenses, reimbursements, payments, or stock
          movements.
        </p>
      </div>
      <div className="library-grid purchasing-grid">
        {operations.map((operation) => {
          const policy = sourcingPolicy(operation.type),
            items =
              operation.shoppingList?.items.filter((i) => !i.excluded) ?? [],
            done = items.filter((i) => i.purchased).length;
          return (
            <article className="panel recipe-card" key={operation.id}>
              <span className={`type type-${operation.type.toLowerCase()}`}>
                {typeLabels[operation.type]}
              </span>
              <h2>{operation.name}</h2>
              <p>
                {formatDate(operation.startDate)} –{" "}
                {formatDate(operation.endDate)}
                <br />
                {operation.location.name} · {statusLabels[operation.status]}
              </p>
              <p className="field-hint">
                {policy.inventoryOwner === "SCHOOL"
                  ? "School-owned · Organic required"
                  : "Business-owned · Shared stock estimates"}
              </p>
              {operation.shoppingList ? (
                <>
                  <p>
                    {done} of {items.length} items marked purchased
                  </p>
                  <progress
                    aria-label={`${operation.name} shopping progress`}
                    value={done}
                    max={Math.max(items.length, 1)}
                  />
                </>
              ) : (
                <p>
                  {operation.mealPlan
                    ? "Meal plan ready · No shopping list yet"
                    : "Plan meals to calculate ingredient requirements"}
                </p>
              )}
              <div className="form-actions">
                <Link
                  href={`/operations/${operation.id}/shopping`}
                  className="button"
                >
                  {operation.shoppingList
                    ? "Open shopping list"
                    : "View ingredient requirements"}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {!operations.length && (
        <section className="panel empty">
          <h2>No operations yet</h2>
          <p>
            Create an operation and plan meals to begin organizing ingredients.
          </p>
          <Link href="/operations/new" className="button">
            New operation
          </Link>
        </section>
      )}
    </>
  );
}
