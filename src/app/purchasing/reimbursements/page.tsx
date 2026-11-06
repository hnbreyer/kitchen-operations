import { randomUUID } from "node:crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { dateKey } from "@/lib/calendar";
import { formatDate } from "@/lib/config";
import {
  purchaseInclude,
  purchaseBalance,
} from "@/lib/purchasing/transactions";
import { ReimbursementForm } from "@/components/purchasing/transaction-forms";
import {
  PurchaseSummary,
  PurchaseHistory,
  ReimbursementHistory,
} from "@/components/purchasing/purchase-history";
export const dynamic = "force-dynamic";
export default async function Reimbursements({
  searchParams,
}: {
  searchParams: Promise<{ operation?: string; notice?: string }>;
}) {
  const query = await searchParams;
  const purchases = await db.purchase.findMany({
    where: {
      finalized: true,
      funding: "SCHOOL",
      ...(query.operation ? { operationId: query.operation } : {}),
    },
    include: purchaseInclude,
    orderBy: { purchaseDate: "asc" },
  });
  const eligible = purchases.filter((p) => purchaseBalance(p).outstanding > 0);
  return (
    <>
      <Link href="/purchasing" className="text-link">
        ← Back to purchasing
      </Link>
      <div className="page-heading">
        <div>
          <h1>Retreat reimbursements</h1>
          <p>
            School repayments of owner-funded ingredient purchases. These cash
            movements are separate from food sales and service fees.
          </p>
        </div>
      </div>
      {query.notice === "saved" && (
        <p role="status" className="success-message">
          Reimbursement recorded.
        </p>
      )}
      {query.operation && (
        <p>
          Filtered to one operation.{" "}
          <Link className="text-link" href="/purchasing/reimbursements">
            View all retreats
          </Link>
        </p>
      )}
      <section className="panel detail-section">
        <PurchaseSummary purchases={purchases} />
      </section>
      {eligible.length ? (
        <ReimbursementForm
          token={randomUUID()}
          date={dateKey(new Date())}
          purchases={eligible.map((p) => ({
            id: p.id,
            label: `${p.supplier} · ${formatDate(p.purchaseDate)} · ${p.operation?.name}`,
            outstanding: purchaseBalance(p).outstanding,
          }))}
        />
      ) : (
        <section className="panel detail-section">
          <h2>No outstanding eligible purchases</h2>
          <p>
            Record an owner-paid retreat purchase to track its reimbursement.
          </p>
        </section>
      )}
      <section className="panel detail-section">
        <h2>Purchase balances</h2>
        <PurchaseHistory purchases={purchases} />
      </section>
      <section className="panel detail-section">
        <h2>Reimbursement history</h2>
        <p className="field-hint">
          Amounts show allocations to purchases in the current view.
        </p>
        <ReimbursementHistory purchases={purchases} />
      </section>
    </>
  );
}
