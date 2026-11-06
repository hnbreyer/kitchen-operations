import { db } from "@/lib/db";
import { ScheduleEditor } from "@/components/menus/schedule-editor";
export const dynamic = "force-dynamic";
export default async function NewTemplate() {
  const recipes = await db.recipe.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>New menu template</h1>
          <p>Plan as many days and meals as this menu needs.</p>
        </div>
      </div>
      <ScheduleEditor
        mode="template"
        recipes={recipes.map((r) => ({
          id: r.id,
          name: r.name,
          archived: !!r.archivedAt,
        }))}
        initial={{ name: "", description: "", notes: "", meals: [] }}
      />
    </>
  );
}
