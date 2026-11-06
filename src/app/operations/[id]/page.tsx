import Link from "next/link";
import { purchaseInclude } from "@/lib/purchasing/transactions";
import {
  PurchaseHistory,
  PurchaseSummary,
  ReimbursementHistory,
} from "@/components/purchasing/purchase-history";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { businessTimezone, formatDate } from "@/lib/config";
import { statusLabels, typeLabels } from "@/lib/domain";
import { OperationControls } from "@/components/operation-controls";
export const dynamic = "force-dynamic";
export default async function OperationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const operation = await db.operation.findUnique({
    where: { id },
    include: { location: true, mealPlan: true },
  });
  if (!operation) notFound();
  const purchases = await db.purchase.findMany({
    where: { operationId: id, finalized: true },
    include: purchaseInclude,
    orderBy: { purchaseDate: "desc" },
  });
  const { notice } = await searchParams;
  const count = (value: number | null) =>
    value == null ? "Unconfirmed" : String(value);
  const target =
    operation.expectedDiners == null
      ? null
      : operation.expectedDiners + (operation.additionalMealBuffer ?? 0);
  return (
    <>
      <Link href="/operations" className="text-link">
        ← Back to operations
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">OPERATION DETAILS</p>
          <h1>{operation.name}</h1>
          <p>
            {formatDate(operation.startDate)} – {formatDate(operation.endDate)}{" "}
            · {operation.location.name}
          </p>
        </div>
        <Link href={`/operations/${id}/edit`} className="button">
          Edit operation
        </Link>
      </div>
      {(notice === "saved" || notice === "status") && (
        <p role="status" className="success-message">
          {notice === "saved" ? "Operation saved." : "Status updated."}
        </p>
      )}
      <section className="panel detail-section">
        <div className="detail-badges">
          <span className={`type type-${operation.type.toLowerCase()}`}>
            {typeLabels[operation.type]}
          </span>
          <span className={`status status-${operation.status.toLowerCase()}`}>
            {statusLabels[operation.status]}
          </span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Start date</dt>
            <dd>{formatDate(operation.startDate)}</dd>
          </div>
          <div>
            <dt>End date (inclusive)</dt>
            <dd>{formatDate(operation.endDate)}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{operation.location.name}</dd>
          </div>
          <div>
            <dt>Expected diners (including staff)</dt>
            <dd>{count(operation.expectedDiners)}</dd>
          </div>
          {operation.type === "RETREAT" && (
            <>
              <div>
                <dt>Full-rate billable participants</dt>
                <dd>{count(operation.billableParticipants)}</dd>
              </div>
              <div>
                <dt>Expected staff diners</dt>
                <dd>{count(operation.expectedStaffDiners)}</dd>
              </div>
              <div>
                <dt>Staff meal billing</dt>
                <dd>
                  {operation.staffDiscountPercent}% discount ·{" "}
                  {100 - (operation.staffDiscountPercent ?? 60)}% of standard
                  fee
                </dd>
              </div>
              <div>
                <dt>Additional meal buffer</dt>
                <dd>
                  {operation.additionalMealBuffer == null
                    ? "Not set (0 extra meals)"
                    : operation.additionalMealBuffer}
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>Preparation target</dt>
            <dd>{target == null ? "Unconfirmed" : `${target} meals`}</dd>
          </div>
          <div>
            <dt>Business timezone</dt>
            <dd>{businessTimezone}</dd>
          </div>
        </dl>
        {operation.type === "RETREAT" && (
          <p className="field-hint">
            Expected diners include staff. The preparation target adds the meal
            buffer. Full-rate participants and staff billed at 40% are separate;
            other diners may be unbilled. Retreat ingredients belong to the
            school and must be organic.
          </p>
        )}
        <div className="operation-notes">
          <h2>Notes</h2>
          <p>{operation.notes || "No notes added."}</p>
        </div>
      </section>
      <section className="panel detail-section">
        <h2>Meal planning</h2>
        <p>
          Reuse a menu template or customize the meals and portions for this
          operation.
        </p>
        <Link className="button" href={`/operations/${id}/meals`}>
          Open meal plan
        </Link>
      </section>
      <section className="panel detail-section">
        <h2>Ingredients & Shopping</h2>
        <p>
          Review consolidated ingredient requirements and maintain this
          operation’s shopping list.
        </p>
        <Link className="button" href={`/operations/${id}/shopping`}>
          Ingredients & Shopping
        </Link>
      </section>
      <OperationControls
        key={operation.updatedAt.toISOString()}
        id={id}
        version={operation.updatedAt.toISOString()}
        name={operation.name}
        status={operation.status}
        hasMealPlan={!!operation.mealPlan}
        hasFinancialHistory={purchases.length > 0}
      />
      <section className="panel detail-section">
        <h2>
          Purchases{operation.type === "RETREAT" ? " & Reimbursements" : ""}
        </h2>
        <div className="form-actions">
          <Link className="button" href={`/purchasing/new?operation=${id}`}>
            Record ingredient purchase
          </Link>
          {operation.type === "RETREAT" && (
            <Link
              className="secondary-button"
              href={`/purchasing/reimbursements?operation=${id}`}
            >
              Manage reimbursements
            </Link>
          )}
        </div>
        {operation.type === "RETREAT" && (
          <>
            <PurchaseSummary purchases={purchases} />
            <p className="field-hint">
              Only owner-paid school ingredient purchases create a reimbursement
              balance. School repayments are separate from service-fee revenue;
              no service fees or profitability are calculated here.
            </p>
          </>
        )}
        <h3>Purchase history</h3>
        <PurchaseHistory purchases={purchases} />
        {operation.type === "RETREAT" && (
          <>
            <h3>Reimbursement history</h3>
            <ReimbursementHistory purchases={purchases} />
          </>
        )}
      </section>
    </>
  );
}
