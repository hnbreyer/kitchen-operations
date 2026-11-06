import { seedPurchasing } from "../prisma/seed-purchasing";
import { afterAll, expect, it } from "vitest";
import { PrismaClient, type OperationType } from "@prisma/client";
import {
  calculateRequirements,
  estimatedCost,
} from "../src/lib/purchasing/requirements";
import { getPurchasingContext } from "../src/lib/purchasing/context";
import {
  generateShoppingList,
  saveShoppingItem,
  shoppingItemProgress,
  reviewShoppingList,
  saveAvailableStock,
  saveSubstitution,
  purchaseQuantity,
} from "../src/lib/purchasing/management";
import { saveMealPlan } from "../src/lib/menus/planning";
import { recipeInclude, snapshotRecipe } from "../src/lib/menus/catalog";
import { businessDate } from "../src/lib/calendar";
import { saveOperationRecord } from "../src/lib/operation-management";
import type { PlannedMeal } from "../src/lib/menus/types";
import type { CatalogEntry } from "../src/lib/purchasing/requirements";
if (!process.env.DATABASE_URL?.endsWith("/prisma/test.db"))
  throw new Error("Run npm test with the isolated database.");
const db = new PrismaClient(),
  ids: string[] = [];
afterAll(async () => {
  await db.shoppingItem.deleteMany({
    where: { list: { operationId: { in: ids } } },
  });
  await db.shoppingList.deleteMany({ where: { operationId: { in: ids } } });
  await db.availableStock.deleteMany({ where: { operationId: { in: ids } } });
  await db.ingredientSubstitution.deleteMany({
    where: { operationId: { in: ids } },
  });
  await db.operationMealPlan.deleteMany({
    where: { operationId: { in: ids } },
  });
  await db.operation.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const catalog: CatalogEntry[] = [
  {
    id: "rice",
    name: "Rice",
    baseUnit: "GRAM",
    displayUnit: "KILOGRAM",
    referencePriceCentavos: 1000,
  },
  {
    id: "carrot",
    name: "Carrots",
    baseUnit: "GRAM",
    displayUnit: "GRAM",
    referencePriceCentavos: null,
  },
  {
    id: "pumpkin",
    name: "Pumpkin",
    baseUnit: "GRAM",
    displayUnit: "KILOGRAM",
    referencePriceCentavos: 500,
  },
];
function sampleMeals(): PlannedMeal[] {
  return [1, 2, 3].map((day) => ({
    key: `meal-${day}`,
    date: `2040-02-0${day}`,
    type: "LUNCH",
    notes: "",
    dishes: [
      {
        key: `dish-${day}`,
        recipeId: "r",
        portions: 1,
        snapshot: {
          recipeId: "r",
          name: "Rice bowl",
          description: null,
          standardPortionYield: 3,
          instructions: "Cook rice.",
          preparationMinutes: null,
          category: null,
          notes: null,
          ingredients: [
            {
              ingredientId: "rice",
              name: "Rice",
              quantityMilli: 1,
              unit: "GRAM",
              notes: null,
            },
          ],
        },
      },
    ],
  }));
}
async function operation(type: OperationType = "RETREAT") {
  const op = await db.operation.create({
    data: {
      name: "Requirements test operation",
      type,
      status: "CONFIRMED",
      locationId: "seed-school",
      startDate: businessDate("2040-02-01"),
      endDate: businessDate("2040-02-03"),
      expectedDiners: 40,
      billableParticipants: type === "RETREAT" ? 30 : null,
      expectedStaffDiners: type === "RETREAT" ? 8 : null,
      additionalMealBuffer: type === "RETREAT" ? 4 : null,
      staffDiscountPercent: type === "RETREAT" ? 60 : null,
    },
  });
  ids.push(op.id);
  const recipe = await db.recipe.findUniqueOrThrow({
    where: { id: "seed-recipe-rice" },
    include: recipeInclude,
  });
  const meals: PlannedMeal[] = [1, 2].map((day) => ({
    key: `test-meal-${op.id}-${day}`,
    date: `2040-02-0${day}`,
    type: "LUNCH",
    notes: "",
    dishes: [
      {
        key: `test-dish-${op.id}-${day}`,
        recipeId: recipe.id,
        portions: 10,
        snapshot: snapshotRecipe(recipe),
      },
    ],
  }));
  await db.operationMealPlan.create({
    data: { operationId: op.id, scheduleJson: JSON.stringify(meals) },
  });
  return op;
}
async function context(id: string) {
  return (await getPurchasingContext(id, db))!;
}
it("aggregates exact fractions before rounding once, across repeated dishes and days", () => {
  const result = calculateRequirements(sampleMeals(), catalog);
  expect(result.issues).toEqual([]);
  expect(result.requirements).toHaveLength(1);
  expect(result.requirements[0].requiredMilli).toBe(1);
  expect(result.requirements[0].contributions).toHaveLength(3);
  expect(result.requirements[0].approximate).toBe(false);
  const single = calculateRequirements(sampleMeals().slice(0, 1), catalog);
  expect(single.requirements[0].requiredMilli).toBe(1);
  expect(single.requirements[0].approximate).toBe(true);
});
it("normalizes compatible units, rejects incompatible types, and exposes invalid quantities or portions", () => {
  const meals = sampleMeals();
  meals[0].dishes[0].snapshot.ingredients[0].quantityMilli = 1000;
  meals[0].dishes[0].snapshot.standardPortionYield = 1;
  (meals[0].dishes[0].snapshot.ingredients[0] as { unit: string }).unit =
    "KILOGRAM";
  const result = calculateRequirements(meals.slice(0, 1), catalog);
  expect(result.requirements[0].requiredMilli).toBe(1000000);
  (meals[1].dishes[0].snapshot.ingredients[0] as { unit: string }).unit =
    "MILLILITER";
  expect(calculateRequirements(meals, catalog).issues.join(" ")).toMatch(
    /Incompatible/,
  );
  const missing = sampleMeals();
  missing[0].dishes[0].portions = null;
  missing[1].dishes[0].snapshot.ingredients[0].quantityMilli = -1;
  expect(calculateRequirements(missing, catalog).issues).toHaveLength(2);
  expect(() => purchaseQuantity("1", "LITER", "GRAM")).toThrow("compatible");
  expect(purchaseQuantity("1.125", "KILOGRAM", "GRAM")).toBe(1125000);
  expect(() => purchaseQuantity("0.0001", "GRAM", "GRAM")).toThrow("precision");
});
it("keeps missing prices unavailable and estimates known prices using their quoted units", () => {
  expect(estimatedCost(1500000, "GRAM", 1000, "KILOGRAM")).toBe(1500);
  expect(estimatedCost(1500000, "GRAM", null, "KILOGRAM")).toBeNull();
  expect(estimatedCost(1500000, "GRAM", 1000, "LITER")).toBeNull();
  expect(estimatedCost(1500000, "GRAM", 0, "GRAM")).toBe(0);
});
it("applies explicit operation replacement totals and preserves the original snapshot", () => {
  const meals = sampleMeals(),
    before = structuredClone(meals);
  const result = calculateRequirements(meals, catalog, [
    {
      originalIngredientId: "rice",
      replacementIngredientId: "pumpkin",
      quantityMilli: 2500000n,
      unit: "GRAM",
    },
  ]);
  expect(result.requirements[0].ingredientId).toBe("pumpkin");
  expect(result.requirements[0].requiredMilli).toBe(2500000);
  expect(
    result.requirements[0].contributions.every(
      (c) => c.substitutedFrom === "Rice",
    ),
  ).toBe(true);
  expect(meals).toEqual(before);
});
it("creates one persisted shopping list per operation and keeps school availability separate from business stock", async () => {
  const retreat = await operation(),
    city = await operation("CITY_SERVICE"),
    event = await operation("PRIVATE_EVENT");
  let school = await context(retreat.id),
    business = await context(city.id);
  expect(school.requirements[0].availableMilli).toBeNull();
  expect(business.requirements[0].availableMilli).toBe(3000000);
  expect((await context(event.id)).requirements[0].availableMilli).toBe(
    3000000,
  );
  await saveAvailableStock(
    retreat.id,
    "seed-rice",
    null,
    form({ quantity: "0.3", unit: "KILOGRAM", notes: "School-owned only" }),
    db,
  );
  school = await context(retreat.id);
  expect(school.requirements[0].availableMilli).toBe(300000);
  expect(school.requirements[0].suggestedMilli).toBe(900000);
  expect((await context(city.id)).requirements[0].availableMilli).toBe(3000000);
  for (const op of [retreat, city, event]) {
    const c = await context(op.id);
    const list = await generateShoppingList(op.id, c.fingerprint, db);
    expect(list.ownership).toBe(op.type === "RETREAT" ? "SCHOOL" : "BUSINESS");
    expect(list.organicRequired).toBe(op.type === "RETREAT");
    await expect(
      generateShoppingList(op.id, c.fingerprint, db),
    ).rejects.toThrow("already exists");
  }
  const stored = await db.operation.findUniqueOrThrow({
    where: { id: retreat.id },
  });
  expect(stored.staffDiscountPercent).toBe(60);
  expect(stored.billableParticipants).toBe(30);
  expect(stored.expectedDiners).toBe(40);
});
it("reviews menu changes without overwriting manual quantities, notes, prices or purchase progress", async () => {
  const op = await operation();
  let c = await context(op.id);
  await generateShoppingList(op.id, c.fingerprint, db);
  c = await context(op.id);
  let list = c.operation.shoppingList!,
    item = list.items[0];
  await saveShoppingItem(
    op.id,
    list.updatedAt.toISOString(),
    item.id,
    form({
      quantity: "2",
      unit: "KILOGRAM",
      price: "12.50",
      priceUnit: "KILOGRAM",
      notes: "Collect from the market",
      purchased: "yes",
    }),
    db,
  );
  const plan = await db.operationMealPlan.findUniqueOrThrow({
      where: { operationId: op.id },
    }),
    meals: PlannedMeal[] = JSON.parse(plan.scheduleJson);
  meals[0].dishes[0].portions = 20;
  const currentOp = await db.operation.findUniqueOrThrow({
    where: { id: op.id },
  });
  await saveMealPlan(
    op.id,
    currentOp.updatedAt.toISOString(),
    form({ schedule: JSON.stringify(meals) }),
    db,
  );
  c = await context(op.id);
  expect(c.stale).toBe(true);
  list = c.operation.shoppingList!;
  item = list.items[0];
  expect(item.plannedMilli).toBe(2000000n);
  expect(item.purchased).toBe(true);
  expect(item.notes).toBe("Collect from the market");
  await reviewShoppingList(
    op.id,
    list.updatedAt.toISOString(),
    c.fingerprint,
    form({
      decisions: JSON.stringify([
        { ingredientId: item.ingredientId, choice: "KEEP", usePrice: false },
      ]),
    }),
    db,
  );
  c = await context(op.id);
  item = c.operation.shoppingList!.items[0];
  expect(c.stale).toBe(false);
  expect(item.requiredMilli).toBe(1800000n);
  expect(item.plannedMilli).toBe(2000000n);
  expect(item.estimatedPriceCentavos).toBe(1250);
  expect(item.purchased).toBe(true);
  list = c.operation.shoppingList!;
  await shoppingItemProgress(
    op.id,
    list.updatedAt.toISOString(),
    item.id,
    "exclude",
    db,
  );
  c = await context(op.id);
  expect(c.operation.shoppingList!.items[0].excluded).toBe(true);
  await reviewShoppingList(
    op.id,
    c.operation.shoppingList!.updatedAt.toISOString(),
    c.fingerprint,
    form({
      decisions: JSON.stringify([
        { ingredientId: item.ingredientId, choice: "KEEP" },
      ]),
    }),
    db,
  );
  c = await context(op.id);
  expect(c.operation.shoppingList!.items[0].excluded).toBe(true);
  expect(await db.shoppingItem.count({ where: { listId: list.id } })).toBe(1);
  expect(
    (
      await db.availableStock.findUniqueOrThrow({
        where: {
          scopeKey_ingredientId: {
            scopeKey: "BUSINESS",
            ingredientId: "seed-rice",
          },
        },
      })
    ).quantityMilli,
  ).toBe(3000000n);
});
it("adds manual items without duplicates and applies substitutions without changing reusable recipes or templates", async () => {
  const op = await operation();
  const recipes = await db.recipe.findMany({ include: recipeInclude }),
    templates = await db.menuTemplate.findMany();
  await saveSubstitution(
    op.id,
    op.updatedAt.toISOString(),
    "seed-rice",
    form({
      replacementIngredientId: "seed-pumpkin",
      quantity: "0.75",
      unit: "KILOGRAM",
      notes: "Explicit replacement total",
    }),
    false,
    db,
  );
  let c = await context(op.id);
  expect(c.requirements[0].ingredientId).toBe("seed-pumpkin");
  expect(c.requirements[0].requiredMilli).toBe(750000);
  await generateShoppingList(op.id, c.fingerprint, db);
  c = await context(op.id);
  await saveShoppingItem(
    op.id,
    c.operation.shoppingList!.updatedAt.toISOString(),
    null,
    form({
      ingredientId: "seed-water",
      quantity: "2",
      unit: "LITER",
      price: "",
      priceUnit: "LITER",
      notes: "Preparation water",
    }),
    db,
  );
  c = await context(op.id);
  await expect(
    saveShoppingItem(
      op.id,
      c.operation.shoppingList!.updatedAt.toISOString(),
      null,
      form({
        ingredientId: "seed-water",
        quantity: "1",
        unit: "LITER",
        price: "",
        priceUnit: "LITER",
      }),
      db,
    ),
  ).rejects.toThrow("already on");
  expect(c.operation.shoppingList!.items).toHaveLength(2);
  expect(c.substitutions).toHaveLength(1);
  expect(await db.recipe.findMany({ include: recipeInclude })).toEqual(recipes);
  expect(await db.menuTemplate.findMany()).toEqual(templates);
});
it("database and service rules prevent ownership mixing and stale list updates", async () => {
  const op = await operation();
  const c = await context(op.id),
    list = await generateShoppingList(op.id, c.fingerprint, db);
  const item = await db.shoppingItem.findFirstOrThrow({
    where: { listId: list.id },
  });
  await expect(
    db.shoppingList.update({
      where: { id: list.id },
      data: { ownership: "BUSINESS", organicRequired: false },
    }),
  ).rejects.toThrow();
  await expect(
    db.availableStock.create({
      data: {
        ingredientId: "seed-rice",
        ownership: "SCHOOL",
        scopeKey: "BUSINESS",
        operationId: op.id,
        unit: "GRAM",
        quantityMilli: 100n,
      },
    }),
  ).rejects.toThrow();
  const city = await operation("CITY_SERVICE");
  await expect(
    db.availableStock.create({
      data: {
        ingredientId: "seed-rice",
        ownership: "SCHOOL",
        scopeKey: city.id,
        operationId: city.id,
        unit: "GRAM",
        quantityMilli: 100n,
      },
    }),
  ).rejects.toThrow();
  await shoppingItemProgress(
    op.id,
    list.updatedAt.toISOString(),
    item.id,
    "purchased",
    db,
  );
  await expect(
    shoppingItemProgress(
      op.id,
      list.updatedAt.toISOString(),
      item.id,
      "purchased",
      db,
    ),
  ).rejects.toThrow("changed");
  await expect(
    saveOperationRecord(
      form({
        name: op.name,
        type: "CITY_SERVICE",
        status: "CONFIRMED",
        startDate: "2040-02-01",
        endDate: "2040-02-03",
        locationId: op.locationId,
      }),
      op.id,
      op.updatedAt.toISOString(),
      db,
    ),
  ).rejects.toThrow("ownership");
});

it("reruns purchasing seeds without overwriting shopping edits, progress, estimates, or saved plans", async () => {
  const rollback = new Error("rollback seed-preservation check");
  try {
    await db.$transaction(
      async (tx) => {
        const list = await tx.shoppingList.findUniqueOrThrow({
          where: { operationId: "seed-operation-2" },
        });
        const item = await tx.shoppingItem.findFirstOrThrow({
          where: { listId: list.id },
        });
        await tx.shoppingItem.update({
          where: { id: item.id },
          data: {
            plannedMilli: 1234500n,
            notes: "Owner shopping instructions",
            purchased: true,
            excluded: true,
          },
        });
        const before = {
          items: await tx.shoppingItem.findMany({ orderBy: { id: "asc" } }),
          lists: await tx.shoppingList.findMany({ orderBy: { id: "asc" } }),
          stock: await tx.availableStock.findMany({ orderBy: { id: "asc" } }),
          plans: await tx.operationMealPlan.findMany({
            orderBy: { id: "asc" },
          }),
          substitutions: await tx.ingredientSubstitution.findMany({
            orderBy: { id: "asc" },
          }),
        };
        await seedPurchasing(tx);
        expect(
          await tx.shoppingItem.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before.items);
        expect(
          await tx.shoppingList.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before.lists);
        expect(
          await tx.availableStock.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before.stock);
        expect(
          await tx.operationMealPlan.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before.plans);
        expect(
          await tx.ingredientSubstitution.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before.substitutions);
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
});

it("reviews new and removed requirements while preserving manual additions and explicit exclusions", async () => {
  const op = await operation();
  let c = await context(op.id);
  await generateShoppingList(op.id, c.fingerprint, db);
  c = await context(op.id);
  await saveShoppingItem(
    op.id,
    c.operation.shoppingList!.updatedAt.toISOString(),
    null,
    form({
      ingredientId: "seed-water",
      quantity: "2",
      unit: "LITER",
      price: "",
      priceUnit: "LITER",
      notes: "Keep this manual addition",
    }),
    db,
  );
  c = await context(op.id);
  const rice = c.operation.shoppingList!.items.find(
    (i) => i.ingredientId === "seed-rice",
  )!;
  await shoppingItemProgress(
    op.id,
    c.operation.shoppingList!.updatedAt.toISOString(),
    rice.id,
    "purchased",
    db,
  );
  const plan = await db.operationMealPlan.findUniqueOrThrow({
      where: { operationId: op.id },
    }),
    meals: PlannedMeal[] = JSON.parse(plan.scheduleJson);
  for (const meal of meals) meal.dishes[0].recipeId = "seed-recipe-porridge";
  const current = await db.operation.findUniqueOrThrow({
    where: { id: op.id },
  });
  await saveMealPlan(
    op.id,
    current.updatedAt.toISOString(),
    form({ schedule: JSON.stringify(meals) }),
    db,
  );
  c = await context(op.id);
  expect(c.requirements.some((r) => r.ingredientId === "seed-rice")).toBe(
    false,
  );
  expect(c.operation.shoppingList!.items).toHaveLength(2);
  const decisions = [
    ...new Set([
      ...c.requirements.map((r) => r.ingredientId),
      ...c.operation.shoppingList!.items.map((i) => i.ingredientId),
    ]),
  ].map((ingredientId) => ({
    ingredientId,
    choice:
      ingredientId === "seed-banana"
        ? "EXCLUDE"
        : ingredientId === "seed-water" || ingredientId === "seed-rice"
          ? "KEEP"
          : "SUGGESTED",
  }));
  await reviewShoppingList(
    op.id,
    c.operation.shoppingList!.updatedAt.toISOString(),
    c.fingerprint,
    form({ decisions: JSON.stringify(decisions) }),
    db,
  );
  c = await context(op.id);
  const items = c.operation.shoppingList!.items;
  expect(items.find((i) => i.ingredientId === "seed-rice")!.requiredMilli).toBe(
    0n,
  );
  expect(items.find((i) => i.ingredientId === "seed-rice")!.purchased).toBe(
    true,
  );
  expect(items.find((i) => i.ingredientId === "seed-water")!.notes).toBe(
    "Keep this manual addition",
  );
  expect(items.find((i) => i.ingredientId === "seed-water")!.plannedMilli).toBe(
    2000000n,
  );
  expect(items.find((i) => i.ingredientId === "seed-banana")!.excluded).toBe(
    true,
  );
  expect(items.find((i) => i.ingredientId === "seed-oats")!.plannedMilli).toBe(
    1600000n,
  );
  const count = items.length;
  await reviewShoppingList(
    op.id,
    c.operation.shoppingList!.updatedAt.toISOString(),
    c.fingerprint,
    form({
      decisions: JSON.stringify(
        items.map((i) => ({ ingredientId: i.ingredientId, choice: "KEEP" })),
      ),
    }),
    db,
  );
  expect((await context(op.id)).operation.shoppingList!.items).toHaveLength(
    count,
  );
});
it("blocks incomplete requirements and does not expose business estimates to a reserved school scope", async () => {
  const op = await operation();
  const plan = await db.operationMealPlan.findUniqueOrThrow({
      where: { operationId: op.id },
    }),
    meals: PlannedMeal[] = JSON.parse(plan.scheduleJson);
  meals[0].dishes[0].portions = null;
  await db.operationMealPlan.update({
    where: { id: plan.id },
    data: { scheduleJson: JSON.stringify(meals) },
  });
  const c = await context(op.id);
  expect(c.issues.length).toBeGreaterThan(0);
  await expect(generateShoppingList(op.id, c.fingerprint, db)).rejects.toThrow(
    "missing or invalid",
  );
  await db.operation.create({
    data: {
      id: "BUSINESS",
      name: "Reserved identifier check",
      type: "RETREAT",
      status: "DRAFT",
      locationId: "seed-school",
      startDate: businessDate("2040-02-01"),
      endDate: businessDate("2040-02-02"),
      staffDiscountPercent: 60,
    },
  });
  ids.push("BUSINESS");
  const reserved = await context("BUSINESS");
  expect(reserved.stock).toEqual([]);
  await expect(
    saveAvailableStock(
      "BUSINESS",
      "seed-rice",
      null,
      form({ quantity: "1", unit: "GRAM" }),
      db,
    ),
  ).rejects.toThrow("reserved identifier");
  expect(
    (
      await db.availableStock.findUniqueOrThrow({
        where: {
          scopeKey_ingredientId: {
            scopeKey: "BUSINESS",
            ingredientId: "seed-rice",
          },
        },
      })
    ).quantityMilli,
  ).toBe(3000000n);
});
