import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ScheduleEditor } from "@/components/menus/schedule-editor";
import type { TemplateMeal } from "@/lib/menus/types";
export const dynamic = "force-dynamic";
export default async function EditTemplate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, recipes] = await Promise.all([
    db.menuTemplate.findUnique({ where: { id } }),
    db.recipe.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!template) notFound();
  const meals: TemplateMeal[] = JSON.parse(template.scheduleJson);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Edit menu template</h1>
          <p>Operation meal-plan copies will stay unchanged.</p>
        </div>
      </div>
      <ScheduleEditor
        key={template.updatedAt.toISOString()}
        mode="template"
        id={id}
        version={template.updatedAt.toISOString()}
        recipes={recipes.map((r) => ({
          id: r.id,
          name: r.name,
          archived: !!r.archivedAt,
        }))}
        initial={{
          name: template.name,
          description: template.description ?? "",
          notes: template.notes ?? "",
          meals: meals.map((m) => ({
            key: m.key,
            day: String(m.day),
            date: "",
            type: m.type,
            notes: m.notes,
            dishes: m.dishes.map((d, i) => ({
              key: `${m.key}-${i}`,
              recipeId: d.recipeId,
              portions: "",
            })),
          })),
        }}
      />
    </>
  );
}
