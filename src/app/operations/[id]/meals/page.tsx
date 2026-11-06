import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dateKey, businessDate } from "@/lib/calendar";
import { formatDate } from "@/lib/config";
import { preparationTarget } from "@/lib/menus/quantities";
import { editablePlan, operationDayCount } from "@/lib/menus/planning";
import {
  mealTypes,
  type TemplateMeal,
  type PlannedMeal,
} from "@/lib/menus/types";
import {
  ScheduleEditor,
  ApplyTemplateForm,
} from "@/components/menus/schedule-editor";
import { ScalingPreview } from "@/components/menus/scaling-preview";
export const dynamic = "force-dynamic";
export default async function MealPlanner({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const [operation, recipes, templates] = await Promise.all([
    db.operation.findUnique({ where: { id }, include: { mealPlan: true } }),
    db.recipe.findMany({ orderBy: { name: "asc" } }),
    db.menuTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!operation) notFound();
  const { notice } = await searchParams;
  const planned: PlannedMeal[] = operation.mealPlan
    ? JSON.parse(operation.mealPlan.scheduleJson)
    : [];
  const editable = editablePlan(operation),
    suggested =
      operation.type === "RETREAT"
        ? preparationTarget(
            operation.expectedDiners,
            operation.additionalMealBuffer,
            operation.type,
          )
        : null;
  return (
    <>
      <Link href={`/operations/${id}`} className="text-link">
        ← Back to operation
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PREPARE WITH CONFIDENCE</p>
          <h1>Meal plan</h1>
          <p>
            {operation.name} · {formatDate(operation.startDate)} –{" "}
            {formatDate(operation.endDate)}
          </p>
        </div>
      </div>
      {notice === "saved" && (
        <p role="status" className="success-message">
          Meal plan saved.
        </p>
      )}
      <div className="form-actions">
        <Link className="secondary-button" href={`/operations/${id}/shopping`}>
          View ingredient requirements
        </Link>
      </div>
      <section className="panel detail-section">
        <h2>Saved schedule</h2>
        <p className="field-hint">
          {operation.mealPlan?.sourceTemplateName
            ? `Copied from ${operation.mealPlan.sourceTemplateName}. `
            : "Custom operation menu. "}
          Saved recipe snapshots are independent of later library changes.
        </p>
        {!planned.length && <p>No meals planned yet.</p>}
        {planned.map((meal) => (
          <article className="saved-meal" key={meal.key}>
            <h3>
              {formatDate(businessDate(meal.date))} · {mealTypes[meal.type]}
            </h3>
            {meal.notes && <p>{meal.notes}</p>}
            <ul className="dish-list">
              {meal.dishes.map((dish) => (
                <li key={dish.key}>
                  <strong>{dish.snapshot.name}</strong> ·{" "}
                  {dish.portions == null
                    ? "Portions unconfirmed"
                    : `${dish.portions} planned portions`}
                  <details>
                    <summary>Saved recipe and ingredient preview</summary>
                    <p className="preserve-lines">
                      {dish.snapshot.instructions}
                    </p>
                    {dish.snapshot.notes && <p>{dish.snapshot.notes}</p>}
                    <ScalingPreview
                      recipe={dish.snapshot}
                      initialPortions={dish.portions ?? undefined}
                    />
                  </details>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {operation.mealPlan?.notes && (
          <p className="preserve-lines">{operation.mealPlan.notes}</p>
        )}
      </section>
      {editable ? (
        <>
          <ApplyTemplateForm
            key={`apply-${operation.updatedAt.toISOString()}`}
            operationId={id}
            version={operation.updatedAt.toISOString()}
            hasPlan={!!operation.mealPlan}
            days={operationDayCount(operation)}
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              days: Math.max(
                ...(JSON.parse(t.scheduleJson) as TemplateMeal[]).map(
                  (m) => m.day,
                ),
              ),
            }))}
          />
          <div className="section-heading">
            <div>
              <h2>
                {planned.length
                  ? "Customize saved meals"
                  : "Create a custom meal plan"}
              </h2>
              <p>
                Change recipes or portions deliberately. Reusable menus and
                other operations are not modified.
              </p>
            </div>
          </div>
          <ScheduleEditor
            key={`plan-${operation.updatedAt.toISOString()}`}
            mode="plan"
            operationId={id}
            version={operation.updatedAt.toISOString()}
            startDate={dateKey(operation.startDate)}
            endDate={dateKey(operation.endDate)}
            suggested={suggested}
            recipes={recipes.map((r) => ({
              id: r.id,
              name: r.name,
              archived: !!r.archivedAt,
            }))}
            initial={{
              name: "",
              description: "",
              notes: operation.mealPlan?.notes ?? "",
              meals: planned.map((m) => ({
                key: m.key,
                day: "",
                date: m.date,
                type: m.type,
                notes: m.notes,
                dishes: m.dishes.map((d) => ({
                  key: d.key,
                  recipeId: d.recipeId,
                  portions: d.portions == null ? "" : String(d.portions),
                  snapshotName: d.snapshot.name,
                })),
              })),
            }}
          />
        </>
      ) : (
        <p className="info-strip">
          This meal plan is read-only because the operation is completed,
          cancelled, or has ended.
        </p>
      )}
    </>
  );
}
