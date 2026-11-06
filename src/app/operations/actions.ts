"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  saveOperationRecord,
  changeOperationStatus,
  deleteOperationRecord,
  OperationConflictError,
} from "@/lib/operation-management";
import {
  OperationValidationError,
  type ActionState,
} from "@/lib/operation-input";
function failure(error: unknown): ActionState {
  if (error instanceof OperationValidationError)
    return { message: error.message, errors: error.errors };
  if (error instanceof OperationConflictError)
    return { message: error.message };
  console.error("Operation change failed:", error);
  return { message: "Unable to save this change. Please try again." };
}
function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/operations");
  if (id) {
    revalidatePath(`/operations/${id}`);
    revalidatePath(`/operations/${id}/edit`);
  }
}
export async function saveOperation(
  id: string | null,
  version: string | null,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let saved: { id: string };
  try {
    saved = await saveOperationRecord(form, id, version);
  } catch (e) {
    return failure(e);
  }
  refresh(saved.id);
  redirect(`/operations/${saved.id}?notice=saved`);
}
export async function updateStatus(
  id: string,
  version: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await changeOperationStatus(id, version, String(form.get("status") ?? ""));
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect(`/operations/${id}?notice=status`);
}
export async function deleteOperation(
  id: string,
  version: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await deleteOperationRecord(
      id,
      version,
      String(form.get("confirmation") ?? ""),
    );
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect("/operations?notice=deleted");
}
