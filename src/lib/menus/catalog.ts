import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "../db";
import {
  categories,
  exactDecimal,
  isUnit,
  portions,
  toQuantityMilli,
  units,
} from "./quantities";
import {
  array,
  MenuError,
  nextVersion,
  normalizedName,
  readJson,
  record,
  text,
  versionDate,
} from "./validation";
import type { RecipeSnapshot } from "./types";
export const recipeInclude = {
  ingredients: {
    include: { ingredient: true },
    orderBy: { ingredient: { name: "asc" as const } },
  },
};
export type LoadedRecipe = Prisma.RecipeGetPayload<{
  include: typeof recipeInclude;
}>;
export function snapshotRecipe(recipe: LoadedRecipe): RecipeSnapshot {
  return {
    recipeId: recipe.id,
    name: recipe.name,
    description: recipe.description,
    standardPortionYield: recipe.standardPortionYield,
    instructions: recipe.instructions,
    preparationMinutes: recipe.preparationMinutes,
    category: recipe.category,
    notes: recipe.notes,
    ingredients: recipe.ingredients.map((row) => ({
      ingredientId: row.ingredientId,
      name: row.ingredient.name,
      quantityMilli: row.quantityMilli,
      unit: row.unit,
      notes: row.ingredient.notes,
    })),
  };
}
export async function saveIngredient(
  form: FormData,
  id: string | null = null,
  version: string | null = null,
  client: PrismaClient = db,
) {
  const name = text(form.get("name"), "Ingredient name", 160, true),
    displayUnit = String(form.get("displayUnit"));
  if (!isUnit(displayUnit))
    throw new MenuError("Select a valid standard unit.");
  const price = text(form.get("referencePrice") ?? "", "Reference price", 30);
  const referencePriceUnit = String(
    form.get("referencePriceUnit") ?? displayUnit,
  );
  if (
    !isUnit(referencePriceUnit) ||
    units[referencePriceUnit].base !== units[displayUnit].base
  )
    throw new MenuError(
      "Reference price unit must match the ingredient measurement type.",
    );
  const data = {
    name,
    normalizedName: normalizedName(name),
    displayUnit,
    baseUnit: units[displayUnit].base,
    notes: text(form.get("notes") ?? "", "Notes") || null,
    referencePriceCentavos:
      price === "" ? null : exactDecimal(price, 100, true),
    referencePriceUnit: price === "" ? null : referencePriceUnit,
  };
  return client.$transaction(async (tx) => {
    const duplicate = await tx.ingredient.findUnique({
      where: { normalizedName: data.normalizedName },
    });
    if (duplicate && duplicate.id !== id)
      throw new MenuError(
        "An ingredient with this name already exists. Select or edit the existing ingredient.",
      );
    if (!id) return tx.ingredient.create({ data });
    const old = await tx.ingredient.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            purchaseItems: true,
            recipes: true,
            shoppingItems: true,
            stockEstimates: true,
            originalSubstitutions: true,
            replacementSubstitutions: true,
          },
        },
      },
    });
    if (!old) throw new MenuError("This ingredient no longer exists.");
    if (
      old.baseUnit !== data.baseUnit &&
      Object.values(old._count).some((count) => count > 0)
    )
      throw new MenuError(
        "This ingredient is used by recipes or ingredient-planning records. Its measurement dimension cannot be changed.",
      );
    const updatedAt = versionDate(version);
    const result = await tx.ingredient.updateMany({
      where: { id, updatedAt },
      data: { ...data, updatedAt: nextVersion(updatedAt) },
    });
    if (!result.count)
      throw new MenuError("This ingredient changed. Reload before saving.");
    return { id };
  });
}
export async function saveRecipe(
  form: FormData,
  id: string | null = null,
  version: string | null = null,
  client: PrismaClient = db,
) {
  const name = text(form.get("name"), "Recipe name", 160, true);
  const category = text(form.get("category") ?? "", "Category", 30);
  if (category && !Object.hasOwn(categories, category))
    throw new MenuError("Select a valid recipe category.");
  const minutes = text(
    form.get("preparationMinutes") ?? "",
    "Preparation time",
    10,
  );
  if (
    minutes &&
    (!/^\d+$/.test(minutes) || Number(minutes) < 1 || Number(minutes) > 10080)
  )
    throw new MenuError("Preparation time must be 1–10,080 whole minutes.");
  const data = {
    name,
    description: text(form.get("description") ?? "", "Description") || null,
    standardPortionYield: portions(String(form.get("standardPortionYield"))),
    instructions: text(
      form.get("instructions"),
      "Preparation instructions",
      20000,
      true,
    ),
    category: category || null,
    preparationMinutes: minutes ? Number(minutes) : null,
    notes: text(form.get("notes") ?? "", "Notes") || null,
  };
  const rows = array(
    readJson(form.get("ingredients")),
    "Recipe ingredients",
    100,
  ).map(record);
  const ids = rows.map((row) =>
    text(row.ingredientId, "Ingredient", 100, true),
  );
  if (new Set(ids).size !== ids.length)
    throw new MenuError(
      "Use each ingredient once per recipe; combine repeated quantities.",
    );
  return client.$transaction(async (tx) => {
    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ids } },
    });
    const links = rows.map((row, index) => {
      const ingredient = ingredients.find((i) => i.id === ids[index]);
      if (!ingredient)
        throw new MenuError("A selected ingredient no longer exists.");
      return {
        ingredientId: ingredient.id,
        quantityMilli: toQuantityMilli(
          String(row.quantity),
          String(row.unit),
          ingredient.baseUnit,
        ),
        unit: ingredient.baseUnit,
      };
    });
    if (!id)
      return tx.recipe.create({
        data: { ...data, ingredients: { create: links } },
      });
    const updatedAt = versionDate(version);
    const result = await tx.recipe.updateMany({
      where: { id, updatedAt, archivedAt: null },
      data: { ...data, updatedAt: nextVersion(updatedAt) },
    });
    if (!result.count)
      throw new MenuError(
        "This recipe changed or is archived. Reload before editing.",
      );
    await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
    await tx.recipeIngredient.createMany({
      data: links.map((row) => ({ ...row, recipeId: id })),
    });
    return { id };
  });
}
export async function duplicateRecipe(id: string, client: PrismaClient = db) {
  return client.$transaction(async (tx) => {
    const recipe = await tx.recipe.findUnique({
      where: { id },
      include: recipeInclude,
    });
    if (!recipe) throw new MenuError("Recipe not found.");
    let suffix = 1,
      name = `${recipe.name.slice(0, 140)} (copy)`;
    while (await tx.recipe.findUnique({ where: { name } }))
      name = `${recipe.name.slice(0, 140)} (copy ${++suffix})`;
    return tx.recipe.create({
      data: {
        name,
        description: recipe.description,
        instructions: recipe.instructions,
        standardPortionYield: recipe.standardPortionYield,
        category: recipe.category,
        preparationMinutes: recipe.preparationMinutes,
        notes: recipe.notes,
        ingredients: {
          create: recipe.ingredients.map((r) => ({
            ingredientId: r.ingredientId,
            quantityMilli: r.quantityMilli,
            unit: r.unit,
          })),
        },
      },
    });
  });
}
export async function archiveRecipe(
  id: string,
  version: string,
  archive: boolean,
  client: PrismaClient = db,
) {
  const updatedAt = versionDate(version);
  const result = await client.recipe.updateMany({
    where: { id, updatedAt },
    data: {
      archivedAt: archive ? new Date() : null,
      updatedAt: nextVersion(updatedAt),
    },
  });
  if (!result.count)
    throw new MenuError("This recipe changed. Reload before continuing.");
}
