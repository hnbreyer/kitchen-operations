import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { IngredientForm } from "@/components/menus/ingredient-form";
export const dynamic = "force-dynamic";
export default async function EditIngredient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const i = await db.ingredient.findUnique({ where: { id } });
  if (!i) notFound();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Edit ingredient</h1>
          <p>Existing operation snapshots remain unchanged.</p>
        </div>
      </div>
      <IngredientForm
        id={id}
        version={i.updatedAt.toISOString()}
        initial={{
          name: i.name,
          displayUnit: i.displayUnit,
          referencePriceUnit: i.referencePriceUnit ?? i.displayUnit,
          referencePrice:
            i.referencePriceCentavos == null
              ? ""
              : (i.referencePriceCentavos / 100).toFixed(2),
          notes: i.notes ?? "",
        }}
      />
    </>
  );
}
