import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { recipeInclude } from "@/lib/menus/catalog";
import { decimalString } from "@/lib/menus/quantities";
import { RecipeForm } from "@/components/menus/recipe-form";
export const dynamic = "force-dynamic";
export default async function EditRecipe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [recipe, ingredients] = await Promise.all([
    db.recipe.findUnique({ where: { id }, include: recipeInclude }),
    db.ingredient.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!recipe) notFound();
  if (recipe.archivedAt)
    return (
      <section className="panel empty">
        <h1>Recipe archived</h1>
        <p>Restore this recipe from its detail page before editing.</p>
        <a className="text-link" href={`/recipes/${id}`}>
          View recipe
        </a>
      </section>
    );
  const initial = {
    name: recipe.name,
    description: recipe.description ?? "",
    standardPortionYield: String(recipe.standardPortionYield),
    instructions: recipe.instructions,
    preparationMinutes:
      recipe.preparationMinutes == null
        ? ""
        : String(recipe.preparationMinutes),
    category: recipe.category ?? "",
    notes: recipe.notes ?? "",
    ingredients: recipe.ingredients.map((i) => ({
      ingredientId: i.ingredientId,
      quantity: decimalString(BigInt(i.quantityMilli)),
      unit: i.unit,
    })),
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Edit recipe</h1>
          <p>Existing operation snapshots will stay unchanged.</p>
        </div>
      </div>
      <RecipeForm
        key={recipe.updatedAt.toISOString()}
        id={id}
        version={recipe.updatedAt.toISOString()}
        ingredients={ingredients}
        initial={initial}
      />
    </>
  );
}
