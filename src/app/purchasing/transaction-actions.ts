"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import {
  recordPurchase,
  recordReimbursement,
  editPurchaseMetadata,
  type PurchaseInput,
  type ReimbursementInput,
} from "@/lib/purchasing/transactions";
import { readJson } from "@/lib/menus/validation";
import type { MutationState } from "@/lib/menus/types";
function failure(error: unknown): MutationState {
  return {
    message:
      error instanceof Prisma.PrismaClientKnownRequestError
        ? "Unable to record this change. Check the current balances and reload before retrying; financial history is protected."
        : error instanceof Error
          ? error.message
          : "Unable to save. Your entered values have been kept.",
  };
}
function refresh() {
  revalidatePath("/purchasing", "layout");
  revalidatePath("/operations", "layout");
}
export async function purchaseAction(
  id: string,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await recordPurchase(id, readJson(form.get("payload")) as PurchaseInput);
  } catch (e) {
    return failure(e);
  }
  refresh();
  redirect(`/purchasing/purchases/${id}?notice=saved`);
}
export async function reimbursementAction(
  id: string,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await recordReimbursement(
      id,
      readJson(form.get("payload")) as ReimbursementInput,
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  redirect(`/purchasing/reimbursements?notice=saved`);
}
export async function metadataAction(
  id: string,
  version: string,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await editPurchaseMetadata(id, version, form);
  } catch (e) {
    return failure(e);
  }
  refresh();
  redirect(`/purchasing/purchases/${id}?notice=saved`);
}
