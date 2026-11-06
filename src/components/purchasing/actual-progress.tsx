import Link from "next/link";
import { db } from "@/lib/db";
import { decimalString, units } from "@/lib/menus/quantities";
import { formatMoney } from "@/lib/config";
export async function ActualProgress({ listId }: { listId: string }) {
  const list = await db.shoppingList.findUnique({
    where: { id: listId },
    include: {
      items: { where: { excluded: false } },
      purchases: { where: { finalized: true }, include: { items: true } },
    },
  });
  if (!list) return null;
  return (
    <section className="panel detail-section">
      <h2>Recorded purchases for this list</h2>
      <p>
        Actual quantities are shown separately from the current plan. Checkmarks
        track shopping tasks; they do not prove purchase amounts or ingredient
        consumption.
      </p>
      <Link className="button" href={`/purchasing/new?list=${listId}`}>
        Record purchase from shopping list
      </Link>
      {list.purchases.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Planned purchase</th>
                  <th>Actually purchased</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((i) => {
                  const actual = list.purchases
                    .flatMap((p) => p.items)
                    .filter((p) => p.ingredientId === i.ingredientId)
                    .reduce((s, p) => s + p.quantityMilli, 0n);
                  return (
                    <tr key={i.id}>
                      <td>{i.ingredientName}</td>
                      <td>
                        {decimalString(i.plannedMilli)} {units[i.unit].label}
                      </td>
                      <td>
                        {decimalString(actual)} {units[i.unit].label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul>
            {list.purchases.map((p) => (
              <li key={p.id}>
                <Link
                  className="text-link"
                  href={`/purchasing/purchases/${p.id}`}
                >
                  {p.supplier} · {formatMoney(p.totalCentavos)}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>No actual purchases recorded for this list.</p>
      )}
    </section>
  );
}
