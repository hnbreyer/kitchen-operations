import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/config";
import { decimalString, isUnit, units } from "@/lib/menus/quantities";
import {
  purchaseInclude,
  purchaseBalance,
  paymentSources,
} from "@/lib/purchasing/transactions";
import { MetadataForm } from "@/components/purchasing/transaction-forms";
import { ReimbursementHistory } from "@/components/purchasing/purchase-history";
export const dynamic = "force-dynamic";
export default async function PurchaseDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const p = await db.purchase.findUnique({
    where: { id },
    include: purchaseInclude,
  });
  if (!p || !p.finalized) notFound();
  const b = purchaseBalance(p);
  const { notice } = await searchParams;
  return (
    <>
      <Link className="text-link" href="/purchasing">
        ← Back to purchasing
      </Link>
      <div className="page-heading">
        <div>
          <h1>Purchase from {p.supplier}</h1>
          <p>
            {formatDate(p.purchaseDate)} ·{" "}
            {p.funding === "SCHOOL" ? "School" : "Business"} funded ·{" "}
            {paymentSources[p.paymentSource as keyof typeof paymentSources]}
          </p>
        </div>
      </div>
      {notice === "saved" && (
        <p role="status" className="success-message">
          Purchase saved.
        </p>
      )}
      <section className="panel detail-section">
        <h2>Actual ingredient purchase</h2>
        {p.organicConfirmed && (
          <p>Organic sourcing confirmed for retreat ingredients.</p>
        )}
        <p>
          {p.operation ? (
            <Link href={`/operations/${p.operation.id}`} className="text-link">
              {p.operation.name}
            </Link>
          ) : (
            "Shared business purchasing"
          )}
        </p>
        {p.shoppingListId && (
          <p>
            <Link
              className="text-link"
              href={`/operations/${p.operationId}/shopping`}
            >
              Linked shopping list
            </Link>
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Purchased quantity</th>
                <th>Actual unit price</th>
                <th>Actual amount</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.ingredientName}</td>
                  <td>
                    {decimalString(i.quantityMilli)} {units[i.unit].label}
                  </td>
                  <td>
                    {formatMoney(i.priceCentavos)} /{" "}
                    {isUnit(i.priceUnit)
                      ? units[i.priceUnit].label
                      : i.priceUnit}
                  </td>
                  <td>{formatMoney(i.lineTotalCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>Actual purchase total: {formatMoney(p.totalCentavos)}</strong>
        </p>
        <p>{p.notes || "No notes added."}</p>
        <p>Receipt reference: {p.receiptReference || "Not recorded"}</p>
        <p className="field-hint">
          Actual purchase prices are fixed independently of reference prices.
          Ingredients have not been marked consumed.
        </p>
      </section>
      <section className="panel detail-section">
        <h2>Reimbursement</h2>
        <p>{b.status}</p>
        {b.eligible ? (
          <>
            <p>Reimbursed: {formatMoney(b.reimbursed)}</p>
            <p>
              Outstanding reimbursement balance: {formatMoney(b.outstanding)}
            </p>
            {b.outstanding > 0 && (
              <Link
                className="button"
                href={`/purchasing/reimbursements?operation=${p.operationId}`}
              >
                Record reimbursement payment
              </Link>
            )}
          </>
        ) : (
          <p>Only owner-paid, school-funded retreat purchases are eligible.</p>
        )}
        <ReimbursementHistory purchases={[p]} />
      </section>
      <details>
        <summary>Edit supplier, notes or receipt reference</summary>
        <MetadataForm
          id={p.id}
          version={p.updatedAt.toISOString()}
          supplier={p.supplier}
          notes={p.notes ?? ""}
          receiptReference={p.receiptReference ?? ""}
        />
      </details>
    </>
  );
}
