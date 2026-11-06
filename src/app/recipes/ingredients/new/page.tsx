import { IngredientForm } from "@/components/menus/ingredient-form";
export default function NewIngredient() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>New ingredient</h1>
          <p>Use an existing catalog entry whenever possible.</p>
        </div>
      </div>
      <IngredientForm />
    </>
  );
}
