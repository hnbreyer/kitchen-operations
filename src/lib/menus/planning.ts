import { PrismaClient, type Prisma, type Operation } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { businessDate, dateKey } from "../calendar";
import { portions, preparationTarget } from "./quantities";
import { mealTypes, type TemplateMeal, type PlannedMeal } from "./types";
import {
  array,
  MenuError,
  nextVersion,
  readJson,
  record,
  text,
  versionDate,
} from "./validation";
import { recipeInclude, snapshotRecipe } from "./catalog";
export function parseTemplateSchedule(value: unknown): TemplateMeal[] {
  const meals = array(value, "Meals", 120)
    .map(record)
    .map((meal) => {
      const day = Number(meal.day),
        type = String(meal.type);
      if (!/^\d+$/.test(String(meal.day)) || day < 1 || day > 60)
        throw new MenuError("Template day numbers must be between 1 and 60.");
      if (!Object.hasOwn(mealTypes, type))
        throw new MenuError("Select a valid meal type.");
      const dishes = array(meal.dishes, "Recipes per meal", 20)
        .map(record)
        .map((d) => ({ recipeId: text(d.recipeId, "Recipe", 100, true) }));
      if (new Set(dishes.map((d) => d.recipeId)).size !== dishes.length)
        throw new MenuError("Use a recipe only once in each meal.");
      return {
        key: randomUUID(),
        day,
        type: type as TemplateMeal["type"],
        notes: text(meal.notes ?? "", "Meal notes", 2000),
        dishes,
      };
    });
  if (new Set(meals.map((m) => `${m.day}:${m.type}`)).size !== meals.length)
    throw new MenuError("A day can contain each meal type once.");
  return meals.sort(
    (a, b) =>
      a.day - b.day ||
      Object.keys(mealTypes).indexOf(a.type) -
        Object.keys(mealTypes).indexOf(b.type),
  );
}
async function checkRecipes(tx: Prisma.TransactionClient, ids: string[]) {
  const recipes = await tx.recipe.findMany({
    where: { id: { in: ids }, archivedAt: null },
    include: recipeInclude,
  });
  if (new Set(ids).size !== recipes.length)
    throw new MenuError(
      "A recipe is missing or archived. Replace it with an active recipe before saving or applying this menu.",
    );
  return recipes;
}
export async function saveTemplate(
  form: FormData,
  id: string | null = null,
  version: string | null = null,
  client: PrismaClient = db,
) {
  const meals = parseTemplateSchedule(readJson(form.get("schedule")));
  const data = {
    name: text(form.get("name"), "Template name", 160, true),
    description: text(form.get("description") ?? "", "Description") || null,
    notes: text(form.get("notes") ?? "", "Notes") || null,
    scheduleJson: JSON.stringify(meals),
  };
  return client.$transaction(async (tx) => {
    await checkRecipes(
      tx,
      meals.flatMap((m) => m.dishes.map((d) => d.recipeId)),
    );
    if (!id) return tx.menuTemplate.create({ data });
    const updatedAt = versionDate(version);
    if (
      !(
        await tx.menuTemplate.updateMany({
          where: { id, updatedAt },
          data: { ...data, updatedAt: nextVersion(updatedAt) },
        })
      ).count
    )
      throw new MenuError("This template changed. Reload before saving.");
    return { id };
  });
}
export async function duplicateTemplate(id: string, client: PrismaClient = db) {
  return client.$transaction(async (tx) => {
    const template = await tx.menuTemplate.findUnique({ where: { id } });
    if (!template) throw new MenuError("Template not found.");
    let suffix = 1,
      name = `${template.name.slice(0, 140)} (copy)`;
    while (await tx.menuTemplate.findUnique({ where: { name } }))
      name = `${template.name.slice(0, 140)} (copy ${++suffix})`;
    return tx.menuTemplate.create({
      data: {
        name,
        description: template.description,
        notes: template.notes,
        scheduleJson: template.scheduleJson,
      },
    });
  });
}
export function editablePlan(operation: Pick<Operation, "status" | "endDate">) {
  return (
    operation.status !== "COMPLETED" &&
    operation.status !== "CANCELLED" &&
    dateKey(operation.endDate) >= dateKey(new Date())
  );
}
export function operationDayCount(
  operation: Pick<Operation, "startDate" | "endDate">,
) {
  return (
    Math.round(
      (new Date(`${dateKey(operation.endDate)}T12:00:00Z`).getTime() -
        new Date(`${dateKey(operation.startDate)}T12:00:00Z`).getTime()) /
        86400000,
    ) + 1
  );
}
export function dateForDay(start: Date, day: number) {
  const date = new Date(`${dateKey(start)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}
async function operationForWrite(
  tx: Prisma.TransactionClient,
  id: string,
  version: string,
) {
  const operation = await tx.operation.findUnique({
    where: { id },
    include: { mealPlan: true },
  });
  if (!operation || !editablePlan(operation))
    throw new MenuError(
      "Meal plans can be changed only for draft or confirmed operations that have not ended.",
    );
  const updatedAt = versionDate(version);
  if (
    !(
      await tx.operation.updateMany({
        where: { id, updatedAt },
        data: { updatedAt: nextVersion(updatedAt) },
      })
    ).count
  )
    throw new MenuError(
      "The operation or its meal plan changed. Reload before saving.",
    );
  return operation;
}
export async function applyTemplate(
  operationId: string,
  version: string,
  templateId: string,
  policy: string,
  replace: boolean,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const operation = await operationForWrite(tx, operationId, version);
    if (operation.mealPlan && !replace)
      throw new MenuError("Confirm replacement of the existing meal plan.");
    const template = await tx.menuTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new MenuError("Select an existing menu template.");
    const schedule = parseTemplateSchedule(JSON.parse(template.scheduleJson));
    const templateDays = Math.max(...schedule.map((m) => m.day)),
      operationDays = operationDayCount(operation);
    if (!["MATCH", "FIT"].includes(policy))
      throw new MenuError("Choose a date-range policy.");
    if (policy === "MATCH" && templateDays !== operationDays)
      throw new MenuError(
        `Template covers ${templateDays} days; operation covers ${operationDays}. Explicitly choose to fit available days, or edit the template.`,
      );
    const meals = schedule.filter((m) => m.day <= operationDays);
    if (!meals.length)
      throw new MenuError("No template meals fit within this operation.");
    const recipes = await checkRecipes(
      tx,
      meals.flatMap((m) => m.dishes.map((d) => d.recipeId)),
    );
    const target =
      operation.type === "RETREAT"
        ? preparationTarget(
            operation.expectedDiners,
            operation.additionalMealBuffer,
            operation.type,
          )
        : null;
    const planned: PlannedMeal[] = meals.map((meal) => ({
      key: randomUUID(),
      date: dateForDay(operation.startDate, meal.day),
      type: meal.type,
      notes: meal.notes,
      dishes: meal.dishes.map((dish) => ({
        key: randomUUID(),
        recipeId: dish.recipeId,
        portions: target && target <= 100000 ? target : null,
        snapshot: snapshotRecipe(recipes.find((r) => r.id === dish.recipeId)!),
      })),
    }));
    const data = {
      sourceTemplateName: template.name,
      notes: template.notes,
      scheduleJson: JSON.stringify(planned),
    };
    return tx.operationMealPlan.upsert({
      where: { operationId },
      create: { operationId, ...data },
      update: data,
    });
  });
}
export async function saveMealPlan(
  operationId: string,
  version: string,
  form: FormData,
  client: PrismaClient = db,
) {
  const raw = array(readJson(form.get("schedule")), "Planned meals", 120).map(
    record,
  );
  const notes = text(form.get("notes") ?? "", "Plan notes");
  return client.$transaction(async (tx) => {
    const operation = await operationForWrite(tx, operationId, version);
    const existing: PlannedMeal[] = operation.mealPlan
      ? JSON.parse(operation.mealPlan.scheduleJson)
      : [];
    const oldDishes = new Map(
      existing.flatMap((m) => m.dishes).map((d) => [d.key, d]),
    );
    const usedKeys = new Set<string>();
    const planned: PlannedMeal[] = [];
    for (const meal of raw) {
      const date = text(meal.date, "Meal date", 10, true);
      businessDate(date);
      if (
        date < dateKey(operation.startDate) ||
        date > dateKey(operation.endDate)
      )
        throw new MenuError(
          "Every meal must fall within the operation’s inclusive dates.",
        );
      const type = String(meal.type);
      if (!Object.hasOwn(mealTypes, type))
        throw new MenuError("Select a valid meal type.");
      const dishes: PlannedMeal["dishes"] = [];
      for (const value of array(meal.dishes, "Recipes per meal", 20)) {
        const dish = record(value),
          recipeId = text(dish.recipeId, "Recipe", 100, true);
        const key = text(dish.key ?? "", "Dish key", 100) || randomUUID();
        if (usedKeys.has(key))
          throw new MenuError("Duplicate dish identifiers are not allowed.");
        usedKeys.add(key);
        const old = oldDishes.get(key);
        const snapshot =
          old?.recipeId === recipeId
            ? old.snapshot
            : snapshotRecipe((await checkRecipes(tx, [recipeId]))[0]);
        const count =
          dish.portions === "" || dish.portions == null
            ? null
            : portions(String(dish.portions));
        dishes.push({ key, recipeId, portions: count, snapshot });
      }
      if (new Set(dishes.map((d) => d.recipeId)).size !== dishes.length)
        throw new MenuError(
          "Use a recipe once per meal and adjust its portions.",
        );
      planned.push({
        key: randomUUID(),
        date,
        type: type as PlannedMeal["type"],
        notes: text(meal.notes ?? "", "Meal notes", 2000),
        dishes,
      });
    }
    if (
      new Set(planned.map((m) => `${m.date}:${m.type}`)).size !== planned.length
    )
      throw new MenuError("Each date can contain each meal type once.");
    planned.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Object.keys(mealTypes).indexOf(a.type) -
          Object.keys(mealTypes).indexOf(b.type),
    );
    return tx.operationMealPlan.upsert({
      where: { operationId },
      create: {
        operationId,
        notes: notes || null,
        scheduleJson: JSON.stringify(planned),
      },
      update: { notes: notes || null, scheduleJson: JSON.stringify(planned) },
    });
  });
}
