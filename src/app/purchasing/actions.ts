"use server";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generateShoppingList,
  saveShoppingItem,
  shoppingItemProgress,
  reviewShoppingList,
  saveAvailableStock,
  saveSubstitution,
} from "@/lib/purchasing/management";
import type { MutationState } from "@/lib/menus/types";
function failure(error: unknown): MutationState {
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return {
      message:
        error.code === "P2002"
          ? "This record already exists. Reload and edit the existing item."
          : "Unable to save this change. Reload and try again.",
    };
  return {
    message:
      error instanceof Error ? error.message : "Unable to save this change.",
  };
}
function refresh(id: string) {
  revalidatePath("/purchasing");
  revalidatePath("/operations", "layout");
}
export async function generateAction(
  id: string,
  fingerprint: string,
  _state: MutationState,
  _form: FormData,
): Promise<MutationState> {
  try {
    await generateShoppingList(id, fingerprint);
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect(`/operations/${id}/shopping?notice=generated`);
}
export async function itemAction(
  id: string,
  version: string,
  itemId: string | null,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await saveShoppingItem(id, version, itemId, form);
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect(`/operations/${id}/shopping?notice=saved`);
}
export async function progressAction(
  id: string,
  version: string,
  itemId: string,
  intent: string,
  _state: MutationState,
  _form: FormData,
): Promise<MutationState> {
  try {
    await shoppingItemProgress(id, version, itemId, intent);
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect(`/operations/${id}/shopping?notice=progress`);
}
export async function reviewAction(
  id: string,
  version: string,
  fingerprint: string,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await reviewShoppingList(id, version, fingerprint, form);
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect(`/operations/${id}/shopping?notice=reviewed`);
}
export async function stockAction(
  id: string,
  ingredientId: string,
  version: string | null,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await saveAvailableStock(id, ingredientId, version, form);
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect(`/operations/${id}/shopping?notice=stock`);
}
export async function substitutionAction(
  id: string,
  version: string,
  ingredientId: string,
  remove: boolean,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await saveSubstitution(id, version, ingredientId, form, remove);
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect(`/operations/${id}/shopping?notice=substitution`);
}
