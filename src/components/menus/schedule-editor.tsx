"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  templateAction,
  planAction,
  applyTemplateAction,
} from "@/app/recipes/actions";
import { mealTypes, type EditorMeal, type MealType } from "@/lib/menus/types";
import { Feedback } from "./shared";
export type RecipeOption = { id: string; name: string; archived: boolean };
function blankMeal(date: string, suggested: number | null): EditorMeal {
  return {
    key: crypto.randomUUID(),
    day: "1",
    date,
    type: "LUNCH",
    notes: "",
    dishes: [
      {
        key: crypto.randomUUID(),
        recipeId: "",
        portions: suggested && suggested <= 100000 ? String(suggested) : "",
      },
    ],
  };
}
export function ScheduleEditor({
  mode,
  recipes,
  initial,
  id = null,
  version = null,
  operationId,
  startDate = "",
  endDate = "",
  suggested = null,
}: {
  mode: "template" | "plan";
  recipes: RecipeOption[];
  initial: {
    name: string;
    description: string;
    notes: string;
    meals: EditorMeal[];
  };
  id?: string | null;
  version?: string | null;
  operationId?: string;
  startDate?: string;
  endDate?: string;
  suggested?: number | null;
}) {
  const [values, setValues] = useState(initial);
  const actionFn =
    mode === "template"
      ? templateAction.bind(null, id, version)
      : planAction.bind(null, operationId!, version!);
  const [state, action, pending] = useActionState(actionFn, {});
  const modify = (index: number, patch: Partial<EditorMeal>) =>
    setValues((v) => ({
      ...v,
      meals: v.meals.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  const addMeal = () =>
    setValues((v) => ({
      ...v,
      meals: [...v.meals, blankMeal(startDate, suggested)],
    }));
  return (
    <form
      className="panel schedule-editor"
      action={action}
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <input
        type="hidden"
        name="schedule"
        value={JSON.stringify(values.meals)}
      />
      <fieldset disabled={pending}>
        {mode === "template" && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="menu-name">Template name</label>
              <input
                id="menu-name"
                name="name"
                value={values.name}
                onChange={(e) =>
                  setValues((v) => ({ ...v, name: e.target.value }))
                }
                required
                maxLength={160}
              />
            </div>
            <div className="field full">
              <label htmlFor="menu-description">Description</label>
              <textarea
                id="menu-description"
                name="description"
                value={values.description}
                onChange={(e) =>
                  setValues((v) => ({ ...v, description: e.target.value }))
                }
                rows={2}
              />
            </div>
          </div>
        )}
        <div className="section-heading ingredient-heading">
          <div>
            <h2>{mode === "template" ? "Menu schedule" : "Operation meals"}</h2>
            <p>
              {mode === "template"
                ? "Number days from 1. Add the meals this menu needs."
                : "Dates must stay within the operation. Portions may differ by meal or dish."}
            </p>
          </div>
        </div>
        {mode === "plan" && (
          <p className="field-hint">
            Suggested retreat preparation target:{" "}
            {suggested == null
              ? "not available; enter portions independently"
              : `${suggested} portions`}
            . Staff are already included in expected diners. This is not a
            billing calculation.
          </p>
        )}
        {values.meals.map((meal, index) => (
          <section
            className="meal-editor"
            key={meal.key}
            aria-label={`Meal ${index + 1}`}
          >
            <div className="meal-editor-heading">
              <h3>Meal {index + 1}</h3>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    meals: v.meals.filter((_, i) => i !== index),
                  }))
                }
              >
                Remove meal {index + 1}
              </button>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor={`meal-day-${index}`}>
                  {mode === "template"
                    ? `Day number ${index + 1}`
                    : `Meal date ${index + 1}`}
                </label>
                {mode === "template" ? (
                  <input
                    id={`meal-day-${index}`}
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={meal.day}
                    onChange={(e) => modify(index, { day: e.target.value })}
                    required
                  />
                ) : (
                  <input
                    id={`meal-day-${index}`}
                    type="date"
                    min={startDate}
                    max={endDate}
                    value={meal.date}
                    onChange={(e) => modify(index, { date: e.target.value })}
                    required
                  />
                )}
              </div>
              <div className="field">
                <label htmlFor={`meal-type-${index}`}>
                  Meal type {index + 1}
                </label>
                <select
                  id={`meal-type-${index}`}
                  value={meal.type}
                  onChange={(e) =>
                    modify(index, { type: e.target.value as MealType })
                  }
                >
                  {Object.entries(mealTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {meal.dishes.map((dish, dishIndex) => (
              <div className="dish-editor" key={dish.key}>
                <div className="field">
                  <label htmlFor={`dish-${index}-${dishIndex}`}>
                    Recipe {index + 1}.{dishIndex + 1}
                  </label>
                  <select
                    id={`dish-${index}-${dishIndex}`}
                    value={dish.recipeId}
                    required
                    onChange={(e) =>
                      modify(index, {
                        dishes: meal.dishes.map((d, i) =>
                          i === dishIndex
                            ? {
                                ...d,
                                recipeId: e.target.value,
                                snapshotName: undefined,
                              }
                            : d,
                        ),
                      })
                    }
                  >
                    <option value="">Select recipe</option>
                    {recipes
                      .filter((r) => !r.archived || r.id === dish.recipeId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                          {r.archived ? " (archived)" : ""}
                        </option>
                      ))}
                  </select>
                  {mode === "plan" && dish.snapshotName && (
                    <small className="field-hint">
                      Saved recipe snapshot: {dish.snapshotName}. Keep this
                      selection to preserve its ingredients and instructions;
                      choose another recipe to replace it.
                    </small>
                  )}
                </div>
                {mode === "plan" && (
                  <div className="field">
                    <label htmlFor={`dish-portions-${index}-${dishIndex}`}>
                      Planned portions {index + 1}.{dishIndex + 1}
                    </label>
                    <input
                      id={`dish-portions-${index}-${dishIndex}`}
                      type="number"
                      min="1"
                      max="100000"
                      step="1"
                      placeholder="Unconfirmed"
                      value={dish.portions}
                      onChange={(e) =>
                        modify(index, {
                          dishes: meal.dishes.map((d, i) =>
                            i === dishIndex
                              ? { ...d, portions: e.target.value }
                              : d,
                          ),
                        })
                      }
                    />
                  </div>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Remove recipe ${index + 1}.${dishIndex + 1}`}
                  disabled={meal.dishes.length === 1}
                  onClick={() =>
                    modify(index, {
                      dishes: meal.dishes.filter((_, i) => i !== dishIndex),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary-button"
              disabled={meal.dishes.length >= 20}
              onClick={() =>
                modify(index, {
                  dishes: [
                    ...meal.dishes,
                    {
                      key: crypto.randomUUID(),
                      recipeId: "",
                      portions:
                        suggested && suggested <= 100000
                          ? String(suggested)
                          : "",
                    },
                  ],
                })
              }
            >
              Add recipe to meal {index + 1}
            </button>
            <div className="field form-spaced">
              <label htmlFor={`meal-notes-${index}`}>
                Meal notes {index + 1}
              </label>
              <textarea
                id={`meal-notes-${index}`}
                value={meal.notes}
                onChange={(e) => modify(index, { notes: e.target.value })}
                rows={2}
                maxLength={2000}
              />
            </div>
          </section>
        ))}
        {!values.meals.length && (
          <p className="empty">No meals yet. Add a meal to start planning.</p>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={values.meals.length >= 120}
          onClick={addMeal}
        >
          Add meal
        </button>
        <div className="field form-spaced">
          <label htmlFor="menu-notes">
            {mode === "template" ? "Template notes" : "Plan notes"}
          </label>
          <textarea
            id="menu-notes"
            name="notes"
            value={values.notes}
            onChange={(e) =>
              setValues((v) => ({ ...v, notes: e.target.value }))
            }
            rows={3}
          />
        </div>
        <div className="form-actions">
          <button className="button" disabled={pending || !values.meals.length}>
            {pending
              ? "Saving…"
              : mode === "template"
                ? "Save template"
                : "Save meal plan"}
          </button>
          <Link
            className="secondary-button"
            href={
              mode === "template"
                ? id
                  ? `/recipes/templates/${id}`
                  : "/recipes/templates"
                : `/operations/${operationId}`
            }
          >
            Back
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
export function ApplyTemplateForm({
  operationId,
  version,
  templates,
  hasPlan,
  days,
}: {
  operationId: string;
  version: string;
  templates: { id: string; name: string; days: number }[];
  hasPlan: boolean;
  days: number;
}) {
  const [state, action, pending] = useActionState(
    applyTemplateAction.bind(null, operationId, version),
    {},
  );
  return (
    <form
      action={action}
      className="panel detail-section"
      onReset={(e) => e.preventDefault()}
    >
      <h2>Apply a reusable menu</h2>
      <Feedback message={state.message} />
      <p className="field-hint">
        This operation spans {days} days. Applying a template copies recipe
        snapshots; the reusable menu stays unchanged.
      </p>
      <fieldset disabled={pending}>
        <div className="form-grid form-spaced">
          <div className="field">
            <label htmlFor="templateId">Menu template</label>
            <select id="templateId" name="templateId" required>
              <option value="">Select a template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.days} days)
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="policy">Different day counts</label>
            <select id="policy" name="policy" defaultValue="MATCH">
              <option value="MATCH">Require the same number of days</option>
              <option value="FIT">
                Use only days that fit; leave extra days unplanned
              </option>
            </select>
          </div>
        </div>
        {hasPlan && (
          <label className="confirmation">
            <input type="checkbox" name="replace" value="yes" required />
            Replace the existing meal plan and its customizations.
          </label>
        )}
        <div className="form-actions">
          <button className="button" disabled={pending || !templates.length}>
            {pending ? "Applying…" : "Apply template"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
