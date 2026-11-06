"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ingredientAction } from "@/app/recipes/actions";
import { units, type Unit } from "@/lib/menus/quantities";
import { Feedback } from "./shared";
export function IngredientForm({
  initial,
  id = null,
  version = null,
}: {
  initial?: {
    name: string;
    displayUnit: string;
    referencePrice: string;
    referencePriceUnit?: string;
    notes: string;
  };
  id?: string | null;
  version?: string | null;
}) {
  const [values, setValues] = useState({
    name: "",
    displayUnit: "GRAM",
    referencePrice: "",
    notes: "",
    ...initial,
    referencePriceUnit:
      initial?.referencePriceUnit ?? initial?.displayUnit ?? "GRAM",
  });
  const [state, action, pending] = useActionState(
    ingredientAction.bind(null, id, version),
    {},
  );
  const field = (key: keyof typeof values) => ({
    id: key,
    name: key,
    value: values[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setValues((v) => ({
        ...v,
        [key]: e.target.value,
        ...(key === "displayUnit"
          ? { referencePrice: "", referencePriceUnit: e.target.value }
          : key === "referencePriceUnit"
            ? { referencePrice: "" }
            : {}),
      })),
  });
  return (
    <form
      className="panel operation-form"
      action={action}
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <fieldset disabled={pending}>
        <legend>Ingredient information</legend>
        <p className="field-hint">
          Use one identity for an ingredient, regardless of organic sourcing.
          Only vegan ingredients belong in this catalog.
        </p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Ingredient name</label>
            <input {...field("name")} required maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="displayUnit">Standard unit</label>
            <select {...field("displayUnit")}>
              {Object.entries(units).map(([key, unit]) => (
                <option key={key} value={key}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="referencePrice">Reference price (BRL)</label>
            <input
              {...field("referencePrice")}
              inputMode="decimal"
              placeholder="Optional, e.g. 12.50"
            />
            <p className="field-hint">
              An estimated reference, not an actual cost. The price unit is
              separate from the standard measurement unit. Changing either unit
              clears the price for explicit re-entry.
            </p>
          </div>
          <div className="field">
            <label htmlFor="referencePriceUnit">Reference price per</label>
            <select {...field("referencePriceUnit")}>
              {Object.entries(units)
                .filter(
                  ([, unit]) =>
                    unit.base === units[values.displayUnit as Unit].base,
                )
                .map(([key, unit]) => (
                  <option key={key} value={key}>
                    {unit.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="notes">Notes</label>
            <textarea {...field("notes")} rows={3} />
          </div>
        </div>
        <div className="form-actions">
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : "Save ingredient"}
          </button>
          <Link className="secondary-button" href="/recipes/ingredients">
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
