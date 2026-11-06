import Link from "next/link";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/config";
import { units, type Unit } from "@/lib/menus/quantities";
export const dynamic = "force-dynamic";
export default async function Ingredients({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const ingredients = await db.ingredient.findMany({
    orderBy: { name: "asc" },
  });
  const { notice } = await searchParams;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ingredients</h1>
          <p>
            A shared vegan catalog. Use the same ingredient entry for organic
            and conventional sourcing.
          </p>
        </div>
        <Link className="button" href="/recipes/ingredients/new">
          New ingredient
        </Link>
      </div>
      {notice === "saved" && (
        <p role="status" className="success-message">
          Ingredient saved.
        </p>
      )}
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ingredient</th>
                <th>Standard unit</th>
                <th>Reference price</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>{units[i.displayUnit as Unit].label}</td>
                  <td>
                    {i.referencePriceCentavos == null
                      ? "Not set"
                      : `${formatMoney(i.referencePriceCentavos)} / ${units[(i.referencePriceUnit ?? i.displayUnit) as Unit].label}`}
                  </td>
                  <td>{i.notes || "—"}</td>
                  <td>
                    <Link
                      className="text-link"
                      href={`/recipes/ingredients/${i.id}/edit`}
                    >
                      Edit {i.name}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ingredients.length && (
          <p className="empty">
            No ingredients yet. Create an ingredient to begin a recipe.
          </p>
        )}
      </section>
    </>
  );
}
