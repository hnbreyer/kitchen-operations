import { afterAll, expect, it } from "vitest";
import { PrismaClient, type OperationType } from "@prisma/client";
import {
  archiveRecipe,
  duplicateRecipe,
  recipeInclude,
  saveIngredient,
  saveRecipe,
} from "../src/lib/menus/catalog";
import {
  applyTemplate,
  duplicateTemplate,
  saveMealPlan,
  saveTemplate,
} from "../src/lib/menus/planning";
import {
  preparationTarget,
  scaledQuantity,
  toQuantityMilli,
  exactDecimal,
} from "../src/lib/menus/quantities";
import {
  deleteOperationRecord,
  saveOperationRecord,
} from "../src/lib/operation-management";
import { businessDate } from "../src/lib/calendar";
import type { PlannedMeal } from "../src/lib/menus/types";
if (!process.env.DATABASE_URL?.endsWith("/prisma/test.db"))
  throw new Error("Use npm test with the isolated database.");
const db = new PrismaClient();
const ids = {
  recipes: [] as string[],
  ingredients: [] as string[],
  templates: [] as string[],
  operations: [] as string[],
};
afterAll(async () => {
  await db.operationMealPlan.deleteMany({
    where: { operationId: { in: ids.operations } },
  });
  await db.operation.deleteMany({ where: { id: { in: ids.operations } } });
  await db.menuTemplate.deleteMany({ where: { id: { in: ids.templates } } });
  await db.recipe.deleteMany({ where: { id: { in: ids.recipes } } });
  await db.ingredient.deleteMany({ where: { id: { in: ids.ingredients } } });
  await db.$disconnect();
});
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}
function recipeForm(name = "Fictional test curry") {
  return form({
    name,
    standardPortionYield: "10",
    instructions: "Cook the lentils and carrots until tender.",
    category: "MAIN",
    preparationMinutes: "35",
    notes: "Fictional test recipe.",
    ingredients: JSON.stringify([
      { ingredientId: "seed-lentils", quantity: "0.5", unit: "KILOGRAM" },
      { ingredientId: "seed-carrots", quantity: "250", unit: "GRAM" },
    ]),
  });
}
async function newRecipe() {
  const recipe = await saveRecipe(
    recipeForm(`Fictional test curry ${ids.recipes.length}`),
    null,
    null,
    db,
  );
  ids.recipes.push(recipe.id);
  return db.recipe.findUniqueOrThrow({
    where: { id: recipe.id },
    include: recipeInclude,
  });
}
function schedule(recipeId: string, days = [1, 2]) {
  return days.map((day) => ({
    day,
    type: "LUNCH",
    notes: "Fictional lunch",
    dishes: [{ recipeId }],
  }));
}
async function newTemplate(recipeId: string, days?: number[]) {
  const t = await saveTemplate(
    form({
      name: `Fictional menu ${ids.templates.length}`,
      schedule: JSON.stringify(schedule(recipeId, days)),
    }),
    null,
    null,
    db,
  );
  ids.templates.push(t.id);
  return db.menuTemplate.findUniqueOrThrow({ where: { id: t.id } });
}
async function newOperation(
  type: OperationType = "RETREAT",
  end = "2040-02-02",
) {
  const operation = await db.operation.create({
    data: {
      name: "Fictional menu test operation",
      type,
      status: "CONFIRMED",
      locationId: "seed-school",
      startDate: businessDate("2040-02-01"),
      endDate: businessDate(end),
      expectedDiners: 40,
      billableParticipants: type === "RETREAT" ? 30 : null,
      expectedStaffDiners: type === "RETREAT" ? 8 : null,
      additionalMealBuffer: type === "RETREAT" ? 4 : null,
      staffDiscountPercent: type === "RETREAT" ? 60 : null,
    },
  });
  ids.operations.push(operation.id);
  return operation;
}
it("uses exact compatible conversion and deterministic portion scaling with bounded input", () => {
  expect(toQuantityMilli("0.5", "KILOGRAM", "GRAM")).toBe(500000);
  expect(toQuantityMilli("1.25", "LITER", "MILLILITER")).toBe(1250000);
  expect(toQuantityMilli("0.125", "GRAM", "GRAM")).toBe(125);
  expect(toQuantityMilli("0.5", "EACH", "EACH")).toBe(500);
  expect(() => toQuantityMilli("1", "LITER", "GRAM")).toThrow("incompatible");
  for (const value of [
    "0",
    "-1",
    "NaN",
    "1e20",
    "0.0000001",
    "999999999999999999999999999999999999",
  ])
    expect(() => toQuantityMilli(value, "GRAM", "GRAM")).toThrow();
  expect(scaledQuantity(500000, 10, 30)).toEqual({
    text: "1500",
    approximate: false,
  });
  expect(scaledQuantity(1000, 3, 1)).toEqual({
    text: "0.333",
    approximate: true,
  });
  for (const value of [0, -1, 1.5, 100001])
    expect(() => scaledQuantity(500000, 10, value)).toThrow();
  expect(exactDecimal("12.50", 100, true)).toBe(1250);
  expect(() => exactDecimal("1.001", 100, true)).toThrow();
  expect(preparationTarget(40, 4, "RETREAT")).toBe(44);
  expect(preparationTarget(null, 4, "RETREAT")).toBeNull();
  expect(preparationTarget(40, 4, "CITY_SERVICE")).toBe(40);
});
it("creates and edits ingredients, rejects duplicate identities and incompatible dimension changes", async () => {
  const ingredient = await saveIngredient(
    form({
      name: "Fictional sesame paste",
      displayUnit: "KILOGRAM",
      referencePrice: "12.50",
      notes: "Vegan test ingredient.",
    }),
    null,
    null,
    db,
  );
  ids.ingredients.push(ingredient.id);
  let stored = await db.ingredient.findUniqueOrThrow({
    where: { id: ingredient.id },
  });
  expect(stored.baseUnit).toBe("GRAM");
  expect(stored.referencePriceCentavos).toBe(1250);
  await expect(
    saveIngredient(
      form({ name: "  FICTIONAL   SESAME PASTE ", displayUnit: "GRAM" }),
      null,
      null,
      db,
    ),
  ).rejects.toThrow("already exists");
  await saveIngredient(
    form({
      name: stored.name,
      displayUnit: "GRAM",
      referencePrice: "0.02",
      notes: "Updated note",
    }),
    stored.id,
    stored.updatedAt.toISOString(),
    db,
  );
  stored = await db.ingredient.findUniqueOrThrow({ where: { id: stored.id } });
  expect(stored.referencePriceCentavos).toBe(2);
  expect(stored.notes).toBe("Updated note");
  for (const price of ["-1", "1.001", "NaN"])
    await expect(
      saveIngredient(
        form({
          name: "Invalid ingredient",
          displayUnit: "GRAM",
          referencePrice: price,
        }),
        null,
        null,
        db,
      ),
    ).rejects.toThrow();
  const used = await db.ingredient.findUniqueOrThrow({
    where: { id: "seed-carrots" },
  });
  await expect(
    saveIngredient(
      form({ name: used.name, displayUnit: "LITER" }),
      used.id,
      used.updatedAt.toISOString(),
      db,
    ),
  ).rejects.toThrow("dimension");
});
it("creates, edits, duplicates and archives recipes while validating recipe quantities", async () => {
  let recipe = await newRecipe();
  expect(recipe.ingredients).toHaveLength(2);
  expect(
    recipe.ingredients.find((i) => i.ingredientId === "seed-lentils")!
      .quantityMilli,
  ).toBe(500000);
  const updated = recipeForm("Fictional revised curry");
  updated.set("standardPortionYield", "12");
  await saveRecipe(updated, recipe.id, recipe.updatedAt.toISOString(), db);
  recipe = await db.recipe.findUniqueOrThrow({
    where: { id: recipe.id },
    include: recipeInclude,
  });
  expect(recipe.standardPortionYield).toBe(12);
  const copy = await duplicateRecipe(recipe.id, db);
  ids.recipes.push(copy.id);
  expect(copy.name).toContain("(copy)");
  expect(
    (await db.recipeIngredient.findMany({ where: { recipeId: copy.id } }))
      .map((i) => i.quantityMilli)
      .sort(),
  ).toEqual(recipe.ingredients.map((i) => i.quantityMilli).sort());
  for (const bad of ["0", "-2", "100001"]) {
    const f = recipeForm();
    f.set("standardPortionYield", bad);
    await expect(saveRecipe(f, null, null, db)).rejects.toThrow();
  }
  const invalid = recipeForm();
  invalid.set(
    "ingredients",
    JSON.stringify([
      { ingredientId: "seed-carrots", quantity: "1", unit: "LITER" },
    ]),
  );
  await expect(saveRecipe(invalid, null, null, db)).rejects.toThrow(
    "incompatible",
  );
  await archiveRecipe(recipe.id, recipe.updatedAt.toISOString(), true, db);
  expect(
    (await db.recipe.findUniqueOrThrow({ where: { id: recipe.id } }))
      .archivedAt,
  ).not.toBeNull();
});
it("creates, edits and duplicates multi-day templates without altering the original", async () => {
  const recipe = await newRecipe();
  const template = await newTemplate(recipe.id);
  const copy = await duplicateTemplate(template.id, db);
  ids.templates.push(copy.id);
  expect(copy.scheduleJson).toBe(template.scheduleJson);
  const edit = form({
    name: copy.name,
    description: "Variation",
    schedule: JSON.stringify(schedule(recipe.id, [1, 2, 3])),
  });
  await saveTemplate(edit, copy.id, copy.updatedAt.toISOString(), db);
  expect(
    (await db.menuTemplate.findUniqueOrThrow({ where: { id: template.id } }))
      .scheduleJson,
  ).toBe(template.scheduleJson);
  const invalid = form({
    name: "Invalid schedule",
    schedule: JSON.stringify(schedule(recipe.id, [1, 1])),
  });
  await expect(saveTemplate(invalid, null, null, db)).rejects.toThrow("once");
});
it("applies templates and customizes portions for every operation type without changing billing or templates", async () => {
  const recipe = await newRecipe();
  const template = await newTemplate(recipe.id);
  for (const type of ["RETREAT", "CITY_SERVICE", "PRIVATE_EVENT"] as const) {
    let operation = await newOperation(type);
    await applyTemplate(
      operation.id,
      operation.updatedAt.toISOString(),
      template.id,
      "MATCH",
      false,
      db,
    );
    let plan = await db.operationMealPlan.findUniqueOrThrow({
      where: { operationId: operation.id },
    });
    const meals: PlannedMeal[] = JSON.parse(plan.scheduleJson);
    expect(meals).toHaveLength(2);
    expect(meals[0].dishes[0].portions).toBe(type === "RETREAT" ? 44 : null);
    meals[0].dishes[0].portions = 22;
    meals[0].dishes[0].snapshot.name = "Untrusted client name";
    operation = await db.operation.findUniqueOrThrow({
      where: { id: operation.id },
    });
    await saveMealPlan(
      operation.id,
      operation.updatedAt.toISOString(),
      form({
        schedule: JSON.stringify(meals),
        notes: "Deliberate meal adjustment",
      }),
      db,
    );
    plan = await db.operationMealPlan.findUniqueOrThrow({
      where: { id: plan.id },
    });
    const stored: PlannedMeal[] = JSON.parse(plan.scheduleJson);
    expect(stored[0].dishes[0].portions).toBe(22);
    expect(stored[0].dishes[0].snapshot.name).toBe(recipe.name);
    const preserved = await db.operation.findUniqueOrThrow({
      where: { id: operation.id },
    });
    expect(preserved.expectedDiners).toBe(40);
    expect(preserved.staffDiscountPercent).toBe(type === "RETREAT" ? 60 : null);
    expect(preserved.billableParticipants).toBe(type === "RETREAT" ? 30 : null);
    expect(preserved.expectedStaffDiners).toBe(type === "RETREAT" ? 8 : null);
  }
  expect(
    (await db.menuTemplate.findUniqueOrThrow({ where: { id: template.id } }))
      .scheduleJson,
  ).toBe(template.scheduleJson);
});
it("preserves recipe snapshots through library edits, archive, and completed-operation history", async () => {
  let recipe = await newRecipe();
  const originalName = recipe.name;
  const template = await newTemplate(recipe.id);
  let op = await newOperation();
  await applyTemplate(
    op.id,
    op.updatedAt.toISOString(),
    template.id,
    "MATCH",
    false,
    db,
  );
  const before = await db.operationMealPlan.findUniqueOrThrow({
    where: { operationId: op.id },
  });
  await saveTemplate(
    form({
      name: template.name,
      description: "Updated library menu",
      schedule: JSON.stringify(
        schedule(recipe.id, [1, 2]).map((meal) => ({
          ...meal,
          type: "DINNER",
          notes: "Changed template after application",
        })),
      ),
    }),
    template.id,
    template.updatedAt.toISOString(),
    db,
  );
  expect(
    (
      await db.operationMealPlan.findUniqueOrThrow({
        where: { operationId: op.id },
      })
    ).scheduleJson,
  ).toBe(before.scheduleJson);
  const edited = recipeForm("Changed library recipe");
  edited.set("instructions", "Entirely new instructions.");
  await saveRecipe(edited, recipe.id, recipe.updatedAt.toISOString(), db);
  recipe = await db.recipe.findUniqueOrThrow({
    where: { id: recipe.id },
    include: recipeInclude,
  });
  await archiveRecipe(recipe.id, recipe.updatedAt.toISOString(), true, db);
  expect(
    (
      await db.operationMealPlan.findUniqueOrThrow({
        where: { operationId: op.id },
      })
    ).scheduleJson,
  ).toBe(before.scheduleJson);
  op = await db.operation.findUniqueOrThrow({ where: { id: op.id } });
  await saveMealPlan(
    op.id,
    op.updatedAt.toISOString(),
    form({ schedule: before.scheduleJson }),
    db,
  );
  expect(
    (
      JSON.parse(
        (
          await db.operationMealPlan.findUniqueOrThrow({
            where: { operationId: op.id },
          })
        ).scheduleJson,
      ) as PlannedMeal[]
    )[0].dishes[0].snapshot.name,
  ).toBe(originalName);
  await db.operation.update({
    where: { id: op.id },
    data: { status: "COMPLETED" },
  });
  op = await db.operation.findUniqueOrThrow({ where: { id: op.id } });
  await expect(
    saveMealPlan(
      op.id,
      op.updatedAt.toISOString(),
      form({ schedule: before.scheduleJson }),
      db,
    ),
  ).rejects.toThrow("not ended");
  const future = await newOperation();
  await expect(
    applyTemplate(
      future.id,
      future.updatedAt.toISOString(),
      template.id,
      "MATCH",
      false,
      db,
    ),
  ).rejects.toThrow("archived");
});
it("handles day-count mismatches explicitly and protects planned-operation deletion and dates", async () => {
  const recipe = await newRecipe();
  const template = await newTemplate(recipe.id, [1, 2, 3]);
  let op = await newOperation("RETREAT", "2040-02-01");
  await expect(
    applyTemplate(
      op.id,
      op.updatedAt.toISOString(),
      template.id,
      "MATCH",
      false,
      db,
    ),
  ).rejects.toThrow("3 days; operation covers 1");
  expect(
    (await db.operation.findUniqueOrThrow({ where: { id: op.id } })).updatedAt,
  ).toEqual(op.updatedAt);
  await applyTemplate(
    op.id,
    op.updatedAt.toISOString(),
    template.id,
    "FIT",
    false,
    db,
  );
  op = await db.operation.findUniqueOrThrow({ where: { id: op.id } });
  const plan = await db.operationMealPlan.findUniqueOrThrow({
    where: { operationId: op.id },
  });
  expect(JSON.parse(plan.scheduleJson)).toHaveLength(1);
  await expect(
    applyTemplate(
      op.id,
      op.updatedAt.toISOString(),
      template.id,
      "FIT",
      false,
      db,
    ),
  ).rejects.toThrow("Confirm replacement");
  await expect(
    deleteOperationRecord(op.id, op.updatedAt.toISOString(), op.id, db),
  ).rejects.toThrow("saved meal plan");
  await expect(db.operation.delete({ where: { id: op.id } })).rejects.toThrow();
  const data = form({
    name: op.name,
    type: op.type,
    status: op.status,
    startDate: "2040-02-02",
    endDate: "2040-02-03",
    locationId: op.locationId,
  });
  await expect(
    saveOperationRecord(data, op.id, op.updatedAt.toISOString(), db),
  ).rejects.toThrow("exclude existing");
  const meals: PlannedMeal[] = JSON.parse(plan.scheduleJson);
  meals[0].date = "2040-02-02";
  await expect(
    saveMealPlan(
      op.id,
      op.updatedAt.toISOString(),
      form({ schedule: JSON.stringify(meals) }),
      db,
    ),
  ).rejects.toThrow("within");
});

it("creates custom meal plans without templates for every operation type and rejects stale saves", async () => {
  for (const type of ["RETREAT", "CITY_SERVICE", "PRIVATE_EVENT"] as const) {
    const operation = await newOperation(type);
    const schedule = [
      {
        date: "2040-02-01",
        type: "BREAKFAST",
        notes: "Independent custom menu",
        dishes: [
          {
            key: `custom-${operation.id}`,
            recipeId: "seed-recipe-porridge",
            portions: "17",
          },
        ],
      },
    ];
    const input = form({
      schedule: JSON.stringify(schedule),
      notes: "Fictional custom plan",
    });
    await saveMealPlan(
      operation.id,
      operation.updatedAt.toISOString(),
      input,
      db,
    );
    const stored = await db.operationMealPlan.findUniqueOrThrow({
      where: { operationId: operation.id },
    });
    expect(stored.sourceTemplateName).toBeNull();
    const meals = JSON.parse(stored.scheduleJson) as PlannedMeal[];
    expect(meals[0].dishes[0].portions).toBe(17);
    expect(meals[0].dishes[0].snapshot.ingredients.length).toBeGreaterThan(1);
    await expect(
      saveMealPlan(operation.id, operation.updatedAt.toISOString(), input, db),
    ).rejects.toThrow("changed");
  }
});
