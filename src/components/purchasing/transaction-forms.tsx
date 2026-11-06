"use client";
import { useActionState, useState } from "react";
import {
  purchaseAction,
  reimbursementAction,
  metadataAction,
} from "@/app/purchasing/transaction-actions";
import { units, isUnit, exactDecimal } from "@/lib/menus/quantities";
import { estimatedCost, referenceQuote } from "@/lib/menus/pricing";
import { formatMoney } from "@/lib/config";
import type { PurchaseInput } from "@/lib/purchasing/transactions";
import { Feedback } from "@/components/menus/shared";
type Catalog = {
  id: string;
  name: string;
  baseUnit: "GRAM" | "MILLILITER" | "EACH";
  displayUnit: string;
  referencePriceCentavos: number | null;
  referencePriceUnit: string | null;
};
type OperationOption = { id: string; name: string; type: string };
const sources = {
  OWNER: "Owner paid",
  BUSINESS: "Business paid",
  SCHOOL: "School paid directly",
};
export function PurchaseForm({
  token,
  catalog,
  operations,
  initial,
}: {
  token: string;
  catalog: Catalog[];
  operations: OperationOption[];
  initial: PurchaseInput;
}) {
  const [values, setValues] = useState(initial);
  const [state, action, pending] = useActionState(
    purchaseAction.bind(null, token),
    {},
  );
  const set = (key: keyof PurchaseInput, value: unknown) =>
    setValues((v) => ({ ...v, [key]: value }));
  const line = (
    index: number,
    change: Partial<PurchaseInput["items"][number]>,
  ) =>
    setValues((v) => ({
      ...v,
      items: v.items.map((row, i) =>
        i === index ? { ...row, ...change } : row,
      ),
    }));
  const add = () =>
    set("items", [
      ...values.items,
      {
        ingredientId: "",
        quantity: "",
        unit: "GRAM",
        price: "",
        priceUnit: "KILOGRAM",
        shoppingItemId: "",
      },
    ]);
  const costs = values.items.map((row) => {
    try {
      if (!isUnit(row.unit)) return null;
      return estimatedCost(
        exactDecimal(
          row.quantity,
          units[row.unit].factor,
          false,
          9000000000000000,
        ),
        units[row.unit].base,
        exactDecimal(row.price, 100, true),
        row.priceUnit,
      );
    } catch {
      return null;
    }
  });
  // Preview only; the server independently validates and calculates every amount.
  return (
    <form
      action={action}
      className="panel operation-form"
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <input type="hidden" name="payload" value={JSON.stringify(values)} />
      <fieldset disabled={pending}>
        <legend>Purchase information</legend>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="purchase-date">Purchase date</label>
            <input
              id="purchase-date"
              type="date"
              required
              value={values.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="supplier">Supplier or store</label>
            <input
              id="supplier"
              required
              maxLength={160}
              value={values.supplier}
              onChange={(e) => set("supplier", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="purchase-operation">Operation</label>
            <select
              id="purchase-operation"
              disabled={!!initial.shoppingListId}
              value={values.operationId}
              onChange={(e) => {
                const op = operations.find((o) => o.id === e.target.value);
                setValues((v) => ({
                  ...v,
                  operationId: e.target.value,
                  funding: op?.type === "RETREAT" ? "SCHOOL" : "BUSINESS",
                  paymentSource: "OWNER",
                  organicConfirmed: false,
                }));
              }}
            >
              <option value="">Shared business purchasing</option>
              {operations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="funding">Funding responsibility</label>
            <input
              id="funding"
              readOnly
              value={values.funding === "SCHOOL" ? "School" : "Business"}
            />
          </div>
          <div className="field">
            <label htmlFor="payment-source">Payment source</label>
            <select
              id="payment-source"
              value={values.paymentSource}
              onChange={(e) => set("paymentSource", e.target.value)}
            >
              {Object.entries(sources)
                .filter(([key]) =>
                  values.funding === "SCHOOL"
                    ? key !== "BUSINESS"
                    : key !== "SCHOOL",
                )
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="receipt">Receipt reference</label>
            <input
              id="receipt"
              maxLength={500}
              value={values.receiptReference}
              onChange={(e) => set("receiptReference", e.target.value)}
            />
            <p className="field-hint">
              Receipt number or a reference to your stored receipt. Files are
              not uploaded.
            </p>
          </div>
        </div>
        <h2>Actual ingredient items</h2>
        <p className="field-hint">
          Reference prices are optional estimates. Enter or confirm the actual
          paid prices. Line amounts round once to centavos; totals sum the line
          amounts.
        </p>
        {values.items.map((row, index) => {
          const ingredient = catalog.find((i) => i.id === row.ingredientId);
          const quote = ingredient ? referenceQuote(ingredient) : null;
          return (
            <fieldset className="panel detail-section" key={index}>
              <legend>Purchase item {index + 1}</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={`ingredient-${index}`}>
                    Ingredient {index + 1}
                  </label>
                  <select
                    id={`ingredient-${index}`}
                    required
                    value={row.ingredientId}
                    onChange={(e) => {
                      const i = catalog.find((i) => i.id === e.target.value);
                      const q = i ? referenceQuote(i) : null;
                      line(index, {
                        ingredientId: e.target.value,
                        unit: i?.baseUnit ?? "GRAM",
                        quantity: "",
                        price: "",
                        priceUnit: q?.unit ?? i?.baseUnit ?? "GRAM",
                        shoppingItemId: "",
                      });
                    }}
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
                    Purchased quantity {index + 1}
                  </label>
                  <input
                    id={`quantity-${index}`}
                    required
                    inputMode="decimal"
                    value={row.quantity}
                    onChange={(e) => line(index, { quantity: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`unit-${index}`}>
                    Quantity unit {index + 1}
                  </label>
                  <select
                    id={`unit-${index}`}
                    value={row.unit}
                    onChange={(e) =>
                      line(index, { unit: e.target.value, quantity: "" })
                    }
                  >
                    {Object.entries(units)
                      .filter(
                        ([, u]) =>
                          !ingredient || u.base === ingredient.baseUnit,
                      )
                      .map(([key, u]) => (
                        <option key={key} value={key}>
                          {u.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`price-${index}`}>
                    Actual unit price (BRL) {index + 1}
                  </label>
                  <input
                    id={`price-${index}`}
                    required
                    inputMode="decimal"
                    value={row.price}
                    onChange={(e) => line(index, { price: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`price-unit-${index}`}>
                    Price per {index + 1}
                  </label>
                  <select
                    id={`price-unit-${index}`}
                    value={row.priceUnit}
                    onChange={(e) =>
                      line(index, { priceUnit: e.target.value, price: "" })
                    }
                  >
                    {Object.entries(units)
                      .filter(
                        ([, u]) =>
                          !ingredient || u.base === ingredient.baseUnit,
                      )
                      .map(([key, u]) => (
                        <option key={key} value={key}>
                          {u.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {quote && (
                <p>
                  Reference: {formatMoney(quote.price)} /{" "}
                  {units[quote.unit].label}{" "}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      line(index, {
                        price: (quote.price / 100).toFixed(2),
                        priceUnit: quote.unit,
                      })
                    }
                  >
                    Use reference estimate for item {index + 1}
                  </button>
                </p>
              )}
              <p>
                Actual line total:{" "}
                {costs[index] == null
                  ? "Enter valid quantity and price"
                  : formatMoney(costs[index]!)}
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  set(
                    "items",
                    values.items.filter((_, i) => i !== index),
                  )
                }
              >
                Remove item {index + 1}
              </button>
            </fieldset>
          );
        })}
        <button
          type="button"
          className="secondary-button"
          onClick={add}
          disabled={values.items.length >= 100}
        >
          Add ingredient item
        </button>
        <p aria-live="polite">
          Purchase total:{" "}
          {costs.length && costs.every((c) => c != null)
            ? formatMoney(costs.reduce((s, c) => s + (c ?? 0), 0))
            : "Complete all items"}
        </p>
        <div className="field">
          <label htmlFor="purchase-notes">Purchase notes</label>
          <textarea
            id="purchase-notes"
            maxLength={10000}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
        {values.funding === "SCHOOL" && (
          <p>
            <label>
              <input
                type="checkbox"
                required
                checked={values.organicConfirmed}
                onChange={(e) => set("organicConfirmed", e.target.checked)}
              />{" "}
              I confirm these retreat ingredients meet organic sourcing
              requirements.
            </label>
          </p>
        )}
        <p>
          <label>
            <input
              type="checkbox"
              required
              checked={values.confirmed}
              onChange={(e) => set("confirmed", e.target.checked)}
            />{" "}
            I have checked the actual quantities and prices against the
            purchase.
          </label>
        </p>
        <p className="field-hint">
          Recording creates financial history. Amounts, dates, items, funding
          and payment source cannot be edited or deleted afterward. Supplier,
          notes and receipt reference remain editable. No stock consumption or
          shopping checkmark is changed.
        </p>
        <button className="button" disabled={!values.items.length}>
          {pending ? "Recording…" : "Record purchase"}
        </button>
      </fieldset>
    </form>
  );
}
export function ReimbursementForm({
  token,
  date,
  purchases,
}: {
  token: string;
  date: string;
  purchases: { id: string; label: string; outstanding: number }[];
}) {
  const [values, setValues] = useState({
    date,
    notes: "",
    amounts: {} as Record<string, string>,
  });
  const [state, action, pending] = useActionState(
    reimbursementAction.bind(null, token),
    {},
  );
  const allocations = Object.entries(values.amounts)
    .filter(([, v]) => v.trim())
    .map(([purchaseId, amount]) => ({ purchaseId, amount }));
  return (
    <form
      action={action}
      className="panel operation-form"
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({
          date: values.date,
          notes: values.notes,
          allocations,
        })}
      />
      <fieldset disabled={pending}>
        <legend>Record school reimbursement</legend>
        <p>
          Allocate the amount actually received. Leave purchases blank when not
          covered by this payment. Allocations are recorded together as one
          payment and cannot be edited or deleted afterward.
        </p>
        <div className="field">
          <label htmlFor="reimbursement-date">Reimbursement date</label>
          <input
            id="reimbursement-date"
            type="date"
            required
            value={values.date}
            onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
          />
        </div>
        {purchases.map((p) => (
          <div className="field" key={p.id}>
            <label htmlFor={`allocation-${p.id}`}>
              Payment toward {p.label}
            </label>
            <p className="field-hint">
              Outstanding: {formatMoney(p.outstanding)}
            </p>
            <input
              id={`allocation-${p.id}`}
              inputMode="decimal"
              placeholder="Amount in BRL"
              value={values.amounts[p.id] ?? ""}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  amounts: { ...v.amounts, [p.id]: e.target.value },
                }))
              }
            />
          </div>
        ))}
        <p aria-live="polite">
          Payment total:{" "}
          {(() => {
            try {
              return formatMoney(
                allocations.reduce(
                  (s, a) => s + exactDecimal(a.amount, 100),
                  0,
                ),
              );
            } catch {
              return "Enter valid amounts";
            }
          })()}
        </p>
        <div className="field">
          <label htmlFor="reimbursement-notes">Reimbursement notes</label>
          <textarea
            id="reimbursement-notes"
            maxLength={10000}
            value={values.notes}
            onChange={(e) =>
              setValues((v) => ({ ...v, notes: e.target.value }))
            }
          />
        </div>
        <button className="button" disabled={!allocations.length}>
          {pending ? "Recording…" : "Record reimbursement"}
        </button>
      </fieldset>
    </form>
  );
}
export function MetadataForm({
  id,
  version,
  supplier,
  notes,
  receiptReference,
}: {
  id: string;
  version: string;
  supplier: string;
  notes: string;
  receiptReference: string;
}) {
  const [values, setValues] = useState({ supplier, notes, receiptReference });
  const [state, action, pending] = useActionState(
    metadataAction.bind(null, id, version),
    {},
  );
  return (
    <form
      action={action}
      className="panel operation-form"
      onReset={(e) => e.preventDefault()}
    >
      <Feedback message={state.message} />
      <fieldset disabled={pending}>
        <legend>Edit purchase details</legend>
        {Object.entries({
          supplier: "Supplier or store",
          notes: "Notes",
          receiptReference: "Receipt reference",
        }).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={`edit-${key}`}>{label}</label>
            <input
              id={`edit-${key}`}
              name={key}
              required={key === "supplier"}
              maxLength={
                key === "notes" ? 10000 : key === "supplier" ? 160 : 500
              }
              value={values[key as keyof typeof values]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </div>
        ))}
        <button className="button">
          {pending ? "Saving…" : "Save purchase details"}
        </button>
      </fieldset>
    </form>
  );
}
