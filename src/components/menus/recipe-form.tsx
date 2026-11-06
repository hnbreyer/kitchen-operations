"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { recipeAction, refreshIngredientOptions } from "@/app/recipes/actions";
import { categories, units, type Unit } from "@/lib/menus/quantities";
import { Feedback } from "./shared";
export type RecipeFormData = {
  name: string;
  description: string;
  standardPortionYield: string;
  instructions: string;
  preparationMinutes: string;
  category: string;
  notes: string;
  ingredients: { ingredientId: string; quantity: string; unit: string }[];
};
export function RecipeForm({
  initial,
  ingredients,
  id = null,
  version = null,
}: {
  initial?: RecipeFormData;
  ingredients: {
    id: string;
    name: string;
    baseUnit: string;
    displayUnit: string;
  }[];
  id?: string | null;
  version?: string | null;
}) {
  const [catalog, setCatalog] = useState(ingredients);
  const [refreshError, setRefreshError] = useState("");
  const [refreshing, startRefresh] = useTransition();
  const [values, setValues] = useState<RecipeFormData>(
    initial ?? {
      name: "",
      description: "",
      standardPortionYield: "10",
      instructions: "",
      preparationMinutes: "",
      category: "",
      notes: "",
      ingredients: [{ ingredientId: "", quantity: "", unit: "GRAM" }],
    },
  );
  const [state, action, pending] = useActionState(
    recipeAction.bind(null, id, version),
    {},
  );
  const field = (key: Exclude<keyof RecipeFormData, "ingredients">) => ({
    id: key,
    name: key,
    value: values[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });
  function changeRow(
    index: number,
    change: Partial<RecipeFormData["ingredients"][number]>,
  ) {
    setValues((v) => ({
      ...v,
      ingredients: v.ingredients.map((row, i) =>
        i === index ? { ...row, ...change } : row,
      ),
    }));
  }
  return (
    <form
      className="panel operation-form recipe-editor"
      action={action}
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <input
        type="hidden"
        name="ingredients"
        value={JSON.stringify(values.ingredients)}
      />
      <fieldset disabled={pending}>
        <legend>Vegan recipe</legend>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="name">Recipe name</label>
            <input {...field("name")} required maxLength={160} />
          </div>
          <div className="field full">
            <label htmlFor="description">Description</label>
            <textarea {...field("description")} rows={2} />
          </div>
          <div className="field">
            <label htmlFor="standardPortionYield">Standard portions</label>
            <input
              {...field("standardPortionYield")}
              required
              type="number"
              min="1"
              max="100000"
              step="1"
            />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select {...field("category")}>
              <option value="">Not specified</option>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="preparationMinutes">
              Preparation time (minutes)
            </label>
            <input
              {...field("preparationMinutes")}
              type="number"
              min="1"
              max="10080"
              step="1"
            />
          </div>
        </div>
        <div className="section-heading ingredient-heading">
          <h2>Ingredients</h2>
          <Link
            href="/recipes/ingredients/new"
            target="_blank"
            rel="noopener"
            className="text-link"
          >
            Create ingredient in a new tab ↗
          </Link>
        </div>
        <p className="field-hint">
          Create or edit catalog ingredients in another tab, then refresh the
          ingredient list here. Your recipe draft is retained. Quantities are
          normalized to g, mL, or each; incompatible units are rejected.
        </p>
        <div className="form-actions">
          <Link
            href="/recipes/ingredients"
            target="_blank"
            rel="noopener"
            className="text-link"
          >
            Edit ingredient catalog in a new tab ↗
          </Link>
          <button
            type="button"
            className="secondary-button"
            disabled={refreshing}
            onClick={() =>
              startRefresh(async () => {
                try {
                  setCatalog(await refreshIngredientOptions());
                  setRefreshError("");
                } catch {
                  setRefreshError(
                    "Unable to refresh ingredients. Your recipe draft is still here; please try again.",
                  );
                }
              })
            }
          >
            {refreshing ? "Refreshing…" : "Refresh ingredient list"}
          </button>
        </div>
        <Feedback message={refreshError} />
        {values.ingredients.map((row, index) => {
          const ingredient = catalog.find((i) => i.id === row.ingredientId);
          return (
            <div className="recipe-ingredient-row" key={index}>
              <div className="field">
                <label htmlFor={`ingredient-${index}`}>
                  Ingredient {index + 1}
                </label>
                <select
                  id={`ingredient-${index}`}
                  required
                  value={row.ingredientId}
                  onChange={(e) =>
                    changeRow(index, {
                      ingredientId: e.target.value,
                      unit:
                        catalog.find((i) => i.id === e.target.value)
                          ?.displayUnit ?? "GRAM",
                    })
                  }
                >
                  <option value="">Select ingredient</option>
                  {catalog.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`quantity-${index}`}>
                  Quantity {index + 1}
                </label>
                <input
                  id={`quantity-${index}`}
                  required
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(e) =>
                    changeRow(index, { quantity: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={`unit-${index}`}>Unit {index + 1}</label>
                <select
                  id={`unit-${index}`}
                  value={row.unit}
                  onChange={(e) => changeRow(index, { unit: e.target.value })}
                >
                  {Object.entries(units)
                    .filter(
                      ([, u]) => !ingredient || u.base === ingredient.baseUnit,
                    )
                    .map(([key, u]) => (
                      <option value={key} key={key}>
                        {u.label}
                      </option>
                    ))}
                </select>
              </div>
              <button
                className="secondary-button"
                type="button"
                aria-label={`Remove ingredient ${index + 1}`}
                disabled={values.ingredients.length === 1}
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    ingredients: v.ingredients.filter((_, i) => i !== index),
                  }))
                }
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="secondary-button"
          disabled={values.ingredients.length >= 100}
          onClick={() =>
            setValues((v) => ({
              ...v,
              ingredients: [
                ...v.ingredients,
                { ingredientId: "", quantity: "", unit: "GRAM" as Unit },
              ],
            }))
          }
        >
          Add ingredient
        </button>
        <div className="field form-spaced">
          <label htmlFor="instructions">Preparation instructions</label>
          <textarea
            {...field("instructions")}
            rows={6}
            required
            maxLength={20000}
          />
        </div>
        <div className="field form-spaced">
          <label htmlFor="notes">Recipe notes</label>
          <textarea {...field("notes")} rows={3} />
        </div>
        <div className="form-actions">
          <button className="button" disabled={pending || !catalog.length}>
            {pending ? "Saving…" : "Save recipe"}
          </button>
          <Link
            href={id ? `/recipes/${id}` : "/recipes"}
            className="secondary-button"
          >
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
