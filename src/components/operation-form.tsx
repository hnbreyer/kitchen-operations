"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveOperation } from "@/app/operations/actions";
import type { OperationFormValues, ActionState } from "@/lib/operation-input";
import { typeLabels, statusLabels } from "@/lib/domain";
export function OperationForm({
  initial,
  locations,
  timezone,
  id = null,
  version = null,
}: {
  initial: OperationFormValues;
  locations: { id: string; name: string }[];
  timezone: string;
  id?: string | null;
  version?: string | null;
}) {
  const [values, setValues] = useState(initial);
  const [state, action, pending] = useActionState(
    saveOperation.bind(null, id, version),
    {} as ActionState,
  );
  function input(key: keyof OperationFormValues) {
    return {
      name: key,
      id: key,
      value: values[key],
      onChange: (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => setValues((v) => ({ ...v, [key]: e.target.value })),
      "aria-invalid": !!state.errors?.[key],
      "aria-describedby": state.errors?.[key] ? `${key}-error` : undefined,
    };
  }
  function error(key: string) {
    return (
      state.errors?.[key] && (
        <span className="field-error" id={`${key}-error`}>
          {state.errors[key]}
        </span>
      )
    );
  }
  const prepared =
    values.expectedDiners === ""
      ? null
      : Number(values.expectedDiners) +
        (values.type === "RETREAT"
          ? Number(values.additionalMealBuffer || 0)
          : 0);
  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="panel operation-form"
    >
      {state.message && (
        <div className="form-alert" role="alert">
          <p>{state.message}</p>
          {state.errors && (
            <ul>
              {Object.values(state.errors).map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <fieldset disabled={pending}>
        <legend>Operation information</legend>
        <div className="form-grid">
          <div className="field full">
            <label htmlFor="name">
              Operation name <span>(required)</span>
            </label>
            <input {...input("name")} required maxLength={160} />
            {error("name")}
          </div>
          <div className="field">
            <label htmlFor="type">Operation type</label>
            <select {...input("type")}>
              {Object.entries(typeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {error("type")}
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select {...input("status")}>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {error("status")}
          </div>
          <div className="field">
            <label htmlFor="startDate">
              Start date <span>(required)</span>
            </label>
            <input
              {...input("startDate")}
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              required
            />
            {error("startDate")}
          </div>
          <div className="field">
            <label htmlFor="endDate">
              End date <span>(required)</span>
            </label>
            <input
              {...input("endDate")}
              type="date"
              min="1900-01-01"
              max="2100-12-31"
              required
            />
            {error("endDate")}
          </div>
          <p className="field-hint full">
            Dates use {timezone}. The end date is inclusive.
          </p>
          <div className="field full">
            <label htmlFor="locationId">
              Location <span>(required)</span>
            </label>
            <select {...input("locationId")} required>
              <option value="">Select a location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {error("locationId")}
            {!locations.length && (
              <p className="field-hint">
                No locations are available. Add a location through the database
                before creating an operation.
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="expectedDiners">Expected diners</label>
            <input
              {...input("expectedDiners")}
              type="number"
              min="0"
              max="2147483647"
              step="1"
              placeholder="Unconfirmed"
            />
            {error("expectedDiners")}
            <p className="field-hint">
              Everyone eating, including staff. Leave blank until known.
            </p>
          </div>
        </div>
      </fieldset>
      {values.type === "RETREAT" && (
        <fieldset disabled={pending} className="retreat-fields">
          <legend>Retreat meal planning</legend>
          <p className="field-hint">
            Expected diners already include staff. Full-rate participants and
            discounted staff are separate billing groups; other diners may be
            unbilled.
          </p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="billableParticipants">
                Full-rate billable participants
              </label>
              <input
                {...input("billableParticipants")}
                type="number"
                min="0"
                max="2147483647"
                step="1"
                placeholder="Unconfirmed"
              />
              {error("billableParticipants")}
            </div>
            <div className="field">
              <label htmlFor="expectedStaffDiners">Expected staff diners</label>
              <input
                {...input("expectedStaffDiners")}
                type="number"
                min="0"
                max="2147483647"
                step="1"
                placeholder="Unconfirmed"
              />
              {error("expectedStaffDiners")}
              <p className="field-hint">
                Staff meals are billable at 40% of the standard fee (60%
                discount).
              </p>
            </div>
            <div className="field">
              <label htmlFor="additionalMealBuffer">
                Additional meal buffer
              </label>
              <input
                {...input("additionalMealBuffer")}
                type="number"
                min="0"
                max="2147483647"
                step="1"
                placeholder="Not set"
              />
              {error("additionalMealBuffer")}
              <p className="field-hint">
                Extra portions beyond expected diners. The buffer does not add
                billable participants.
              </p>
            </div>
          </div>
        </fieldset>
      )}
      <div className="preparation-summary">
        <strong>
          Preparation target:{" "}
          {prepared == null || !Number.isFinite(prepared) || prepared < 0
            ? "Unconfirmed"
            : `${prepared} meals`}
        </strong>
        <p>
          Expected diners
          {values.type === "RETREAT"
            ? " + additional meal buffer (unset buffer treated as zero)"
            : ""}
          . Counts can be updated as confirmations arrive.
        </p>
      </div>
      <fieldset disabled={pending}>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea {...input("notes")} rows={5} maxLength={10000} />
          {error("notes")}
        </div>
        <div className="form-actions">
          <button className="button" disabled={pending || !locations.length}>
            {pending ? "Saving…" : id ? "Save changes" : "Create operation"}
          </button>
          <Link
            className="secondary-button"
            href={id ? `/operations/${id}` : "/operations"}
          >
            Cancel
          </Link>
        </div>
      </fieldset>
    </form>
  );
}
