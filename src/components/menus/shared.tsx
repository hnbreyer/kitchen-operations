"use client";
import { useActionState } from "react";
import type { MutationState } from "@/lib/menus/types";
export type FormAction = (
  state: MutationState,
  form: FormData,
) => Promise<MutationState>;
export function ActionButton({
  action,
  label,
  className = "secondary-button",
}: {
  action: FormAction;
  label: string;
  className?: string;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return (
    <form action={submit} className="inline-action">
      <button className={className} disabled={pending}>
        {pending ? "Working…" : label}
      </button>
      {state.message && (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
export function Feedback({ message }: { message?: string }) {
  return message ? (
    <p className="form-alert" role="alert">
      {message}
    </p>
  ) : null;
}
