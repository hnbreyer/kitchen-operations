"use server";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  saveIngredient,
  saveRecipe,
  duplicateRecipe,
  archiveRecipe,
} from "@/lib/menus/catalog";
import {
  saveTemplate,
  duplicateTemplate,
  applyTemplate,
  saveMealPlan,
} from "@/lib/menus/planning";
import type { MutationState } from "@/lib/menus/types";
function fail(error: unknown): MutationState {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return { message: "This name is already in use. Choose a different name." };
  if (
    error instanceof Error &&
    !(error instanceof Prisma.PrismaClientKnownRequestError)
  )
    return { message: error.message };
  console.error("Menu change failed", error);
  return { message: "Unable to save this change. Please try again." };
}
function refresh() {
  revalidatePath("/recipes", "layout");
  revalidatePath("/operations", "layout");
}
export async function ingredientAction(
  id: string | null,
  version: string | null,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await saveIngredient(form, id, version);
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect("/recipes/ingredients?notice=saved");
}
export async function recipeAction(
  id: string | null,
  version: string | null,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  let saved;
  try {
    saved = await saveRecipe(form, id, version);
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`/recipes/${saved.id}?notice=saved`);
}
export async function recipeControl(
  id: string,
  version: string,
  intent: string,
  _state: MutationState,
  _form: FormData,
): Promise<MutationState> {
  let copied;
  try {
    if (intent === "duplicate") copied = await duplicateRecipe(id);
    else if (["archive", "restore"].includes(intent))
      await archiveRecipe(id, version, intent === "archive");
    else throw new Error("Invalid recipe action.");
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(
    copied ? `/recipes/${copied.id}/edit` : `/recipes/${id}?notice=saved`,
  );
}
export async function templateAction(
  id: string | null,
  version: string | null,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  let saved;
  try {
    saved = await saveTemplate(form, id, version);
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`/recipes/templates/${saved.id}?notice=saved`);
}
export async function duplicateTemplateAction(
  id: string,
  _state: MutationState,
  _form: FormData,
): Promise<MutationState> {
  let saved;
  try {
    saved = await duplicateTemplate(id);
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`/recipes/templates/${saved.id}/edit`);
}
export async function applyTemplateAction(
  id: string,
  version: string,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await applyTemplate(
      id,
      version,
      String(form.get("templateId") ?? ""),
      String(form.get("policy") ?? ""),
      form.get("replace") === "yes",
    );
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`/operations/${id}/meals?notice=saved`);
}
export async function planAction(
  id: string,
  version: string,
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  try {
    await saveMealPlan(id, version, form);
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`/operations/${id}/meals?notice=saved`);
}

export async function refreshIngredientOptions() {
  const { db } = await import("@/lib/db");
  return db.ingredient.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, baseUnit: true, displayUnit: true },
  });
}
