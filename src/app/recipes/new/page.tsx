import { db } from "@/lib/db";
import { RecipeForm } from "@/components/menus/recipe-form";
export const dynamic = "force-dynamic";
export default async function NewRecipe() {
  const ingredients = await db.ingredient.findMany({
    orderBy: { name: "asc" },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>New recipe</h1>
          <p>Build a reusable vegan recipe.</p>
        </div>
      </div>
      <RecipeForm ingredients={ingredients} />
    </>
  );
}
