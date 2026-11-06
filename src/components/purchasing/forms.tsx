"use client";
import { useActionState, useState } from "react";
import {
  itemAction,
  reviewAction,
  stockAction,
  substitutionAction,
} from "@/app/purchasing/actions";
import { Feedback } from "@/components/menus/shared";
import {
  decimalString,
  units,
  type BaseUnit,
  type Unit,
} from "@/lib/menus/quantities";
export type CatalogOption = { id: string; name: string; baseUnit: BaseUnit };
function quantityText(value: number | null) {
  return value == null ? "" : decimalString(BigInt(value));
}
function UnitOptions({ base }: { base: BaseUnit }) {
  return (
    <>
      {Object.entries(units)
        .filter(([, u]) => u.base === base)
        .map(([key, u]) => (
          <option key={key} value={key}>
            {u.label}
          </option>
        ))}
    </>
  );
}
export function ShoppingItemForm({
  operationId,
  version,
  item,
  catalog,
}: {
  operationId: string;
  version: string;
  item?: {
    id: string;
    ingredientId: string;
    unit: BaseUnit;
    plannedMilli: number;
    price: number | null;
    priceUnit: string | null;
    referenceUnit?: string | null;
    notes: string;
    purchased: boolean;
  };
  catalog: CatalogOption[];
}) {
  const [ingredientId, setIngredientId] = useState(item?.ingredientId ?? ""),
    [quantity, setQuantity] = useState(
      quantityText(item?.plannedMilli ?? null),
    ),
    [unit, setUnit] = useState<string>(item?.unit ?? "GRAM"),
    [price, setPrice] = useState(
      item?.price == null ? "" : (item.price / 100).toFixed(2),
    ),
    [priceUnit, setPriceUnit] = useState(
      item?.priceUnit ?? item?.referenceUnit ?? item?.unit ?? "GRAM",
    ),
    [notes, setNotes] = useState(item?.notes ?? ""),
    [purchased, setPurchased] = useState(item?.purchased ?? false);
  const [state, action, pending] = useActionState(
    itemAction.bind(null, operationId, version, item?.id ?? null),
    {},
  );
  const base =
    catalog.find((i) => i.id === ingredientId)?.baseUnit ??
    item?.unit ??
    "GRAM";
  return (
    <form
      action={action}
      className="shopping-edit-form"
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <fieldset disabled={pending}>
        {!item && (
          <div className="field">
            <label htmlFor="manual-ingredient">Ingredient</label>
            <select
              id="manual-ingredient"
              name="ingredientId"
              required
              value={ingredientId}
              onChange={(e) => {
                setIngredientId(e.target.value);
                const next =
                  catalog.find((i) => i.id === e.target.value)?.baseUnit ??
                  "GRAM";
                setUnit(next);
                setPriceUnit(next);
                setQuantity("");
                setPrice("");
              }}
            >
              <option value="">Select an ingredient</option>
              {catalog.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="form-grid form-spaced">
          <div className="field">
            <label htmlFor={`purchase-${item?.id ?? "new"}`}>
              Planned purchase quantity
            </label>
            <input
              id={`purchase-${item?.id ?? "new"}`}
              name="quantity"
              inputMode="decimal"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`unit-${item?.id ?? "new"}`}>Purchase unit</label>
            <select
              id={`unit-${item?.id ?? "new"}`}
              name="unit"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setQuantity("");
              }}
            >
              <UnitOptions base={base} />
            </select>
          </div>
          <div className="field">
            <label htmlFor={`price-${item?.id ?? "new"}`}>
              Estimated unit price (BRL)
            </label>
            <input
              id={`price-${item?.id ?? "new"}`}
              name="price"
              inputMode="decimal"
              placeholder="Not available"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`price-unit-${item?.id ?? "new"}`}>Price per</label>
            <select
              id={`price-unit-${item?.id ?? "new"}`}
              name="priceUnit"
              value={priceUnit}
              onChange={(e) => {
                setPriceUnit(e.target.value);
                setPrice("");
              }}
            >
              <UnitOptions base={base} />
            </select>
          </div>
          <div className="field full">
            <label htmlFor={`notes-${item?.id ?? "new"}`}>
              Supplier or shopping notes
            </label>
            <textarea
              id={`notes-${item?.id ?? "new"}`}
              name="notes"
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <p className="field-hint">
          Leave the estimated price blank to use the catalog reference without
          saving a list-specific price.
        </p>
        <label className="confirmation">
          <input
            type="checkbox"
            name="purchased"
            value="yes"
            checked={purchased}
            onChange={(e) => setPurchased(e.target.checked)}
          />
          Purchased (shopping progress only)
        </label>
        <div className="form-actions">
          <button className="button" disabled={pending}>
            {pending
              ? "Saving…"
              : item
                ? "Save shopping item"
                : "Add shopping item"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export type ReviewRow = {
  ingredientId: string;
  name: string;
  oldRequired: number | null;
  required: number;
  oldPlanned: number | null;
  suggested: number;
  unit: BaseUnit;
  excluded: boolean;
  purchased: boolean;
  priceChanged: boolean;
  manual: boolean;
};
export function ShoppingReview({
  operationId,
  version,
  fingerprint,
  rows,
}: {
  operationId: string;
  version: string;
  fingerprint: string;
  rows: ReviewRow[];
}) {
  const [decisions, setDecisions] = useState(
    rows.map((r) => ({
      ingredientId: r.ingredientId,
      choice: r.oldPlanned == null ? "EXCLUDE" : "KEEP",
      usePrice: false,
    })),
  );
  const [state, action, pending] = useActionState(
    reviewAction.bind(null, operationId, version, fingerprint),
    {},
  );
  return (
    <form
      action={action}
      className="panel detail-section shopping-review"
      id="review"
      onReset={(e) => e.preventDefault()}
    >
      <h2>Review requirement changes</h2>
      <p>
        Nothing below changes until you apply this review. Keep retains purchase
        quantities, notes, exclusions, and purchased flags. Suggested quantities
        replace only purchase quantities. Excluded items remain saved and can be
        restored.
      </p>
      <Feedback message={state.message} />
      <input type="hidden" name="decisions" value={JSON.stringify(decisions)} />
      <fieldset disabled={pending}>
        {rows.map((r, index) => (
          <div className="review-row" key={r.ingredientId}>
            <h3>
              {r.name}
              {r.oldPlanned == null
                ? " · New requirement"
                : r.required === 0
                  ? " · No longer required"
                  : ""}
            </h3>
            <p>
              Required:{" "}
              {r.oldRequired == null
                ? "Not on list"
                : quantityText(r.oldRequired)}{" "}
              → {quantityText(r.required)} {units[r.unit].label}. Purchase:{" "}
              {r.oldPlanned == null ? "Not set" : quantityText(r.oldPlanned)}.
              New suggestion: {quantityText(r.suggested)} {units[r.unit].label}.
            </p>
            <p className="field-hint">
              {r.excluded ? "Currently excluded. " : ""}
              {r.purchased ? "Marked purchased. " : ""}
              {r.manual ? "Manually added. " : ""}Notes and purchased status are
              preserved for every choice.
            </p>
            <div className="field">
              <label htmlFor={`decision-${r.ingredientId}`}>
                Action for {r.name}
              </label>
              <select
                id={`decision-${r.ingredientId}`}
                value={decisions[index].choice}
                onChange={(e) =>
                  setDecisions((values) =>
                    values.map((v, i) =>
                      i === index ? { ...v, choice: e.target.value } : v,
                    ),
                  )
                }
              >
                {r.oldPlanned != null && (
                  <option value="KEEP">
                    Keep my purchase quantity and inclusion status
                  </option>
                )}
                <option value="SUGGESTED">
                  Use suggested purchase quantity and include item
                </option>
                <option value="EXCLUDE">
                  Leave off the active shopping list
                </option>
              </select>
            </div>
            {r.priceChanged && (
              <label className="confirmation">
                <input
                  type="checkbox"
                  checked={decisions[index].usePrice}
                  onChange={(e) =>
                    setDecisions((values) =>
                      values.map((v, i) =>
                        i === index ? { ...v, usePrice: e.target.checked } : v,
                      ),
                    )
                  }
                />
                Use current catalog reference price for {r.name}
              </label>
            )}
          </div>
        ))}
        <div className="form-actions">
          <button className="button" disabled={pending}>
            {pending ? "Applying…" : "Apply reviewed changes"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function StockForm({
  operationId,
  ingredientId,
  version,
  base,
  initial,
  notes,
  ownership,
}: {
  operationId: string;
  ingredientId: string;
  version: string | null;
  base: BaseUnit;
  initial: number | null;
  notes: string;
  ownership: string;
}) {
  const [quantity, setQuantity] = useState(quantityText(initial)),
    [unit, setUnit] = useState<string>(base),
    [note, setNote] = useState(notes);
  const [state, action, pending] = useActionState(
    stockAction.bind(null, operationId, ingredientId, version),
    {},
  );
  return (
    <form
      action={action}
      className="shopping-edit-form"
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <fieldset disabled={pending}>
        <p className="field-hint">
          {ownership === "SCHOOL"
            ? "School-owned availability for this retreat only. Business stock is not used."
            : "Shared business stock estimate. No reservation is made for this operation."}
        </p>
        <div className="form-grid form-spaced">
          <div className="field">
            <label htmlFor={`available-${ingredientId}`}>
              Available quantity estimate
            </label>
            <input
              id={`available-${ingredientId}`}
              name="quantity"
              required
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`available-unit-${ingredientId}`}>
              Availability unit
            </label>
            <select
              id={`available-unit-${ingredientId}`}
              name="unit"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setQuantity("");
              }}
            >
              <UnitOptions base={base} />
            </select>
          </div>
          <div className="field full">
            <label htmlFor={`available-notes-${ingredientId}`}>
              Availability notes
            </label>
            <textarea
              id={`available-notes-${ingredientId}`}
              name="notes"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="secondary-button" disabled={pending}>
            {pending ? "Saving…" : "Save availability estimate"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function SubstitutionForm({
  operationId,
  version,
  originalIngredientId,
  catalog,
  initial,
}: {
  operationId: string;
  version: string;
  originalIngredientId: string;
  catalog: CatalogOption[];
  initial?: {
    replacementIngredientId: string;
    quantityMilli: number;
    unit: BaseUnit;
    notes: string;
  };
}) {
  const [replacement, setReplacement] = useState(
      initial?.replacementIngredientId ?? "",
    ),
    [quantity, setQuantity] = useState(
      quantityText(initial?.quantityMilli ?? null),
    ),
    [unit, setUnit] = useState<string>(initial?.unit ?? "GRAM"),
    [notes, setNotes] = useState(initial?.notes ?? "");
  const base = catalog.find((i) => i.id === replacement)?.baseUnit ?? "GRAM";
  const [state, action, pending] = useActionState(
    substitutionAction.bind(
      null,
      operationId,
      version,
      originalIngredientId,
      false,
    ),
    {},
  );
  return (
    <form
      action={action}
      className="shopping-edit-form"
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <fieldset disabled={pending}>
        <p className="field-hint">
          Enter the total replacement amount for this operation. No 1:1
          conversion is assumed. This explicit amount stays fixed if portions
          change, so review it after menu changes.
        </p>
        <div className="form-grid form-spaced">
          <div className="field full">
            <label htmlFor={`replacement-${originalIngredientId}`}>
              Replacement ingredient
            </label>
            <select
              id={`replacement-${originalIngredientId}`}
              name="replacementIngredientId"
              required
              value={replacement}
              onChange={(e) => {
                setReplacement(e.target.value);
                setQuantity("");
                setUnit(
                  catalog.find((i) => i.id === e.target.value)?.baseUnit ??
                    "GRAM",
                );
              }}
            >
              <option value="">Select a replacement</option>
              {catalog
                .filter((i) => i.id !== originalIngredientId)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`replacement-quantity-${originalIngredientId}`}>
              Total replacement quantity
            </label>
            <input
              id={`replacement-quantity-${originalIngredientId}`}
              name="quantity"
              required
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`replacement-unit-${originalIngredientId}`}>
              Replacement unit
            </label>
            <select
              id={`replacement-unit-${originalIngredientId}`}
              name="unit"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                setQuantity("");
              }}
            >
              <UnitOptions base={base} />
            </select>
          </div>
          <div className="field full">
            <label htmlFor={`replacement-notes-${originalIngredientId}`}>
              Substitution notes
            </label>
            <textarea
              id={`replacement-notes-${originalIngredientId}`}
              name="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="secondary-button" disabled={pending}>
            {pending ? "Saving…" : "Save substitution"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function PrintShoppingList() {
  return (
    <button
      type="button"
      className="secondary-button"
      onClick={() => window.print()}
    >
      Print shopping list
    </button>
  );
}
