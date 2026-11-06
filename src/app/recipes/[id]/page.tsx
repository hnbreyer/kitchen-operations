import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { recipeInclude, snapshotRecipe } from "@/lib/menus/catalog";
import { referenceQuote } from "@/lib/menus/pricing";
import { ScalingPreview } from "@/components/menus/scaling-preview";
import { ActionButton } from "@/components/menus/shared";
import { recipeControl } from "../actions";
export const dynamic = "force-dynamic";
export default async function RecipeDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const recipe = await db.recipe.findUnique({
    where: { id },
    include: recipeInclude,
  });
  if (!recipe) notFound();
  const { notice } = await searchParams;
  return (
    <>
      <Link href="/recipes" className="text-link">
        ← Recipe library
      </Link>
      <div className="page-heading">
        <div>
          <h1>{recipe.name}</h1>
          <p>
            {recipe.standardPortionYield} standard portions
            {recipe.preparationMinutes
              ? ` · ${recipe.preparationMinutes} minutes`
              : ""}
            {recipe.archivedAt ? " · Archived" : ""}
          </p>
        </div>
        <div className="form-actions">
          {!recipe.archivedAt && (
            <Link className="button" href={`/recipes/${id}/edit`}>
              Edit recipe
            </Link>
          )}
          <ActionButton
            label="Duplicate recipe"
            action={recipeControl.bind(
              null,
              id,
              recipe.updatedAt.toISOString(),
              "duplicate",
            )}
          />
          <ActionButton
            label={recipe.archivedAt ? "Restore recipe" : "Archive recipe"}
            action={recipeControl.bind(
              null,
              id,
              recipe.updatedAt.toISOString(),
              recipe.archivedAt ? "restore" : "archive",
            )}
          />
        </div>
      </div>
      {notice === "saved" && (
        <p role="status" className="success-message">
          Recipe saved.
        </p>
      )}
      <section className="panel detail-section">
        <p>{recipe.description || "No description added."}</p>
        <h2>Ingredient scaling</h2>
        <ScalingPreview
          recipe={snapshotRecipe(recipe)}
          prices={recipe.ingredients.flatMap((row) => {
            const quote = referenceQuote(row.ingredient);
            return quote ? [{ ingredientId: row.ingredientId, ...quote }] : [];
          })}
        />
        <div className="operation-notes">
          <h2>Preparation instructions</h2>
          <p>{recipe.instructions}</p>
          <h2>Recipe notes</h2>
          <p>{recipe.notes || "No notes added."}</p>
        </div>
      </section>
      <p className="footnote">
        Archiving hides a recipe from new selections. Existing meal-plan
        snapshots remain intact.
      </p>
    </>
  );
}
