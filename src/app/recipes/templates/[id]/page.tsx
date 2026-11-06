import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { mealTypes, type TemplateMeal } from "@/lib/menus/types";
import { ActionButton } from "@/components/menus/shared";
import { duplicateTemplateAction } from "../../actions";
export const dynamic = "force-dynamic";
export default async function TemplateDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const template = await db.menuTemplate.findUnique({ where: { id } });
  if (!template) notFound();
  const meals: TemplateMeal[] = JSON.parse(template.scheduleJson);
  const recipes = await db.recipe.findMany({
    where: {
      id: { in: meals.flatMap((m) => m.dishes.map((d) => d.recipeId)) },
    },
  });
  const { notice } = await searchParams;
  return (
    <>
      <Link href="/recipes/templates" className="text-link">
        ← Menu templates
      </Link>
      <div className="page-heading">
        <div>
          <h1>{template.name}</h1>
          <p>{template.description}</p>
        </div>
        <div className="form-actions">
          <Link className="button" href={`/recipes/templates/${id}/edit`}>
            Edit template
          </Link>
          <ActionButton
            label="Duplicate template"
            action={duplicateTemplateAction.bind(null, id)}
          />
        </div>
      </div>
      {notice === "saved" && (
        <p role="status" className="success-message">
          Menu template saved.
        </p>
      )}
      <div className="menu-schedule">
        {meals.map((m) => (
          <section className="panel detail-section" key={m.key}>
            <h2>
              Day {m.day} · {mealTypes[m.type]}
            </h2>
            <ul className="dish-list">
              {m.dishes.map((d) => {
                const r = recipes.find((r) => r.id === d.recipeId);
                return (
                  <li key={d.recipeId}>
                    {r ? (
                      <Link href={`/recipes/${r.id}`}>
                        {r.name}
                        {r.archivedAt
                          ? " (archived; replace before applying)"
                          : ""}
                      </Link>
                    ) : (
                      "Missing recipe; edit this template"
                    )}
                  </li>
                );
              })}
            </ul>
            {m.notes && <p>{m.notes}</p>}
          </section>
        ))}
      </div>
      <section className="panel detail-section">
        <h2>Template notes</h2>
        <p className="preserve-lines">{template.notes || "No notes added."}</p>
        <p className="field-hint">
          Apply this schedule from an operation’s meal planner. Recipes are
          copied as snapshots at that time.
        </p>
      </section>
    </>
  );
}
