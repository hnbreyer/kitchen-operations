import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/config";
import {
  purchaseBalance,
  type RecordedPurchase,
} from "@/lib/purchasing/transactions";
export function PurchaseHistory({
  purchases,
}: {
  purchases: RecordedPurchase[];
}) {
  return purchases.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date / supplier</th>
            <th>Operation</th>
            <th>Funding / payer</th>
            <th>Actual amount</th>
            <th>Reimbursement</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => {
            const b = purchaseBalance(p);
            return (
              <tr key={p.id}>
                <td>
                  <Link
                    className="text-link"
                    href={`/purchasing/purchases/${p.id}`}
                  >
                    {p.supplier}
                  </Link>
                  <br />
                  {formatDate(p.purchaseDate)}
                </td>
                <td>{p.operation?.name ?? "Shared business purchasing"}</td>
                <td>
                  {p.funding === "SCHOOL" ? "School" : "Business"}
                  <br />
                  {p.paymentSource === "OWNER"
                    ? "Owner paid"
                    : p.paymentSource === "SCHOOL"
                      ? "School paid directly"
                      : "Business paid"}
                </td>
                <td>{formatMoney(p.totalCentavos)}</td>
                <td>
                  {b.status}
                  {b.eligible && (
                    <>
                      <br />
                      {formatMoney(b.outstanding)} outstanding
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <p>No purchases recorded.</p>
  );
}
export function PurchaseSummary({
  purchases,
}: {
  purchases: RecordedPurchase[];
}) {
  const school = purchases.filter((p) => p.funding === "SCHOOL");
  const total = school.reduce((s, p) => s + p.totalCentavos, 0),
    received = school.reduce((s, p) => s + purchaseBalance(p).reimbursed, 0),
    outstanding = school.reduce(
      (s, p) => s + purchaseBalance(p).outstanding,
      0,
    );
  return (
    <dl className="detail-grid">
      <div>
        <dt>School-funded ingredient purchases</dt>
        <dd>{formatMoney(total)}</dd>
      </div>
      <div>
        <dt>Reimbursements received</dt>
        <dd>{formatMoney(received)}</dd>
      </div>
      <div>
        <dt>Outstanding reimbursement balance</dt>
        <dd>{formatMoney(outstanding)}</dd>
      </div>
      <div>
        <dt>Paid directly by school</dt>
        <dd>
          {formatMoney(
            school
              .filter((p) => p.paymentSource === "SCHOOL")
              .reduce((s, p) => s + p.totalCentavos, 0),
          )}
        </dd>
      </div>
    </dl>
  );
}
export function ReimbursementHistory({
  purchases,
}: {
  purchases: RecordedPurchase[];
}) {
  const payments = new Map<
    string,
    {
      date: Date;
      amount: number;
      notes: string | null;
      allocations: { supplier: string; id: string; amount: number }[];
    }
  >();
  for (const p of purchases)
    for (const a of p.allocations) {
      const existing = payments.get(a.reimbursementId) ?? {
        date: a.reimbursement.paymentDate,
        amount: 0,
        notes: a.reimbursement.notes,
        allocations: [],
      };
      existing.amount += a.amountCentavos;
      existing.allocations.push({
        supplier: p.supplier,
        id: p.id,
        amount: a.amountCentavos,
      });
      payments.set(a.reimbursementId, existing);
    }
  return payments.size ? (
    <ul>
      {[...payments.entries()]
        .sort(([, a], [, b]) => b.date.getTime() - a.date.getTime())
        .map(([id, p]) => (
          <li key={id}>
            <strong>
              {formatDate(p.date)} · {formatMoney(p.amount)}
            </strong>
            {p.notes && <p>{p.notes}</p>}
            <ul>
              {p.allocations.map((a) => (
                <li key={a.id}>
                  <Link
                    className="text-link"
                    href={`/purchasing/purchases/${a.id}`}
                  >
                    {a.supplier}
                  </Link>{" "}
                  · {formatMoney(a.amount)}
                </li>
              ))}
            </ul>
          </li>
        ))}
    </ul>
  ) : (
    <p>No reimbursements recorded.</p>
  );
}
