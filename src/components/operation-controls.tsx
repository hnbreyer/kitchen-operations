"use client";
import { useActionState, useState } from "react";
import { updateStatus, deleteOperation } from "@/app/operations/actions";
import { statusLabels } from "@/lib/domain";
import type { ActionState } from "@/lib/operation-input";
export function OperationControls({
  id,
  version,
  status,
  name,
  hasMealPlan = false,
  hasFinancialHistory = false,
}: {
  id: string;
  version: string;
  status: string;
  name: string;
  hasMealPlan?: boolean;
  hasFinancialHistory?: boolean;
}) {
  const [statusState, statusAction, saving] = useActionState(
    updateStatus.bind(null, id, version),
    {} as ActionState,
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteOperation.bind(null, id, version),
    {} as ActionState,
  );
  const [confirming, setConfirming] = useState(false);
  const [checked, setChecked] = useState(false);
  return (
    <>
      <section className="panel detail-section">
        <h2>Manage status</h2>
        <form action={statusAction} className="status-form">
          <label htmlFor="operation-status">Operation status</label>
          <select
            id="operation-status"
            name="status"
            defaultValue={status}
            disabled={saving}
          >
            {Object.entries(statusLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
          <button className="button" disabled={saving}>
            {saving ? "Updating…" : "Update status"}
          </button>
        </form>
        {statusState.message && (
          <p role="alert" className="field-error">
            {statusState.message}
          </p>
        )}
        <p className="field-hint">
          Cancelling keeps the operation and all its information.
        </p>
      </section>
      <section className="panel detail-section danger-zone">
        <h2>Remove operation</h2>
        <p>
          Permanent deletion removes this operation. Its location, recipes, and
          ingredients are kept. Cancel the operation instead if you need its
          history.
        </p>
        {hasFinancialHistory ? (
          <p>
            This operation has purchase history and cannot be permanently
            deleted. Cancel it to preserve its history.
          </p>
        ) : hasMealPlan ? (
          <p>
            This operation has a saved meal plan and cannot be permanently
            deleted. Cancel it to preserve its history.
          </p>
        ) : !confirming ? (
          <button
            type="button"
            className="danger-button"
            onClick={() => setConfirming(true)}
          >
            Delete operation
          </button>
        ) : (
          <form action={deleteAction}>
            <p>
              <strong>Delete “{name}” permanently?</strong> This cannot be
              undone.
            </p>
            <label className="confirmation">
              <input
                type="checkbox"
                name="confirmation"
                value={id}
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                required
                disabled={deleting}
              />
              I understand this permanently deletes this operation.
            </label>
            {deleteState.message && (
              <p role="alert" className="field-error">
                {deleteState.errors?.confirmation || deleteState.message}
              </p>
            )}
            <div className="form-actions">
              <button className="danger-button" disabled={!checked || deleting}>
                {deleting ? "Deleting…" : "Permanently delete operation"}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={deleting}
                onClick={() => {
                  setConfirming(false);
                  setChecked(false);
                }}
              >
                Keep operation
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
