import Link from "next/link";
import { db } from "@/lib/db";
import { categories } from "@/lib/menus/quantities";
export const dynamic = "force-dynamic";
export default async function Recipes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 160) : "";
  const recipes = await db.recipe.findMany({
    where: {
      archivedAt: params.archived === "yes" ? { not: null } : null,
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { ingredients: true } } },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COOK WITH A CLEAR PLAN</p>
          <h1>Recipe library</h1>
          <p>Vegan recipes to reuse, scale, and adapt.</p>
        </div>
        <Link className="button" href="/recipes/new">
          New recipe
        </Link>
      </div>
      <form className="search-form" action="/recipes">
        <label htmlFor="recipe-search" className="sr-only">
          Search recipes
        </label>
        <input
          id="recipe-search"
          name="q"
          defaultValue={q}
          placeholder="Search recipes"
        />
        <select
          name="archived"
          aria-label="Recipe visibility"
          defaultValue={params.archived ?? "no"}
        >
          <option value="no">Active recipes</option>
          <option value="yes">Archived recipes</option>
        </select>
        <button className="secondary-button">Search</button>
      </form>
      <div className="library-grid">
        {recipes.map((r) => (
          <Link
            className="panel recipe-card"
            key={r.id}
            href={`/recipes/${r.id}`}
          >
            <span className="subtle-tag">
              {r.archivedAt
                ? "Archived"
                : r.category
                  ? categories[r.category as keyof typeof categories]
                  : "Vegan recipe"}
            </span>
            <h2>{r.name}</h2>
            <p>{r.description || "No description added."}</p>
            <small>
              {r.standardPortionYield} portions · {r._count.ingredients}{" "}
              ingredients
              {r.preparationMinutes ? ` · ${r.preparationMinutes} min` : ""}
            </small>
          </Link>
        ))}
      </div>
      {!recipes.length && (
        <div className="panel empty">
          <h2>No recipes found</h2>
          <p>Try another search or create a vegan recipe.</p>
        </div>
      )}
    </>
  );
}
