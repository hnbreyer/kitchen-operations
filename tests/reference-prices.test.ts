import { afterAll, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { fillUnsetReferencePrices } from "../prisma/reference-prices";
import {
  estimatedCost,
  estimatedRecipeIngredientCost,
  referenceQuote,
  shoppingQuote,
  summarizeCosts,
} from "../src/lib/menus/pricing";
import { recipeInclude, saveIngredient } from "../src/lib/menus/catalog";
if (!process.env.DATABASE_URL?.endsWith("/prisma/test.db"))
  throw new Error("Use npm test with the isolated database.");
const db = new PrismaClient();
afterAll(() => db.$disconnect());
it("stores all supplied and estimated BRL prices with exact quote units without changing measurement units", async () => {
  const expected = [
    ["seed-banana", 800, "KILOGRAM", "GRAM"],
    ["seed-rice", 750, "KILOGRAM", "GRAM"],
    ["seed-carrots", 650, "KILOGRAM", "GRAM"],
    ["seed-chickpeas", 2300, "KILOGRAM", "GRAM"],
    ["seed-lentils", 2200, "KILOGRAM", "GRAM"],
    ["seed-oranges", 500, "KILOGRAM", "GRAM"],
    ["seed-pumpkin", 600, "KILOGRAM", "GRAM"],
    ["seed-coconut-milk", 4000, "LITER", "MILLILITER"],
    ["seed-lemon", 200, "EACH", "EACH"],
    ["seed-olive-oil", 6000, "LITER", "MILLILITER"],
    ["seed-oats", 2000, "KILOGRAM", "GRAM"],
    ["seed-spinach", 3000, "KILOGRAM", "GRAM"],
    ["seed-tomatoes", 1200, "KILOGRAM", "GRAM"],
    ["seed-cocoa", 20000, "KILOGRAM", "GRAM"],
    ["seed-water", 200, "LITER", "MILLILITER"],
  ] as const;
  for (const [id, price, unit, base] of expected) {
    const row = await db.ingredient.findUniqueOrThrow({ where: { id } });
    expect(row.referencePriceCentavos).toBe(price);
    expect(row.referencePriceUnit).toBe(unit);
    expect(row.displayUnit).toBe(base);
    expect(row.baseUnit).toBe(base);
  }
  expect(
    (
      await db.ingredient.findMany({
        where: { referencePriceCentavos: null },
        orderBy: { name: "asc" },
      })
    ).map((i) => i.name),
  ).toEqual([]);
});
it("converts grams and milliliters with no premature per-unit rounding", () => {
  expect(estimatedCost(100000, "GRAM", 750, "KILOGRAM")).toBe(75);
  expect(estimatedCost(600000, "GRAM", 750, "KILOGRAM")).toBe(450);
  expect(estimatedCost(1000000, "GRAM", 2300, "KILOGRAM")).toBe(2300);
  expect(estimatedCost(200000, "MILLILITER", 4000, "LITER")).toBe(800);
  expect(estimatedCost(1000, "MILLILITER", 4000, "LITER")).toBe(4);
  expect(estimatedCost(7500000, "GRAM", 750, "KILOGRAM")).toBe(5625);
  expect(estimatedCost(40000, "MILLILITER", 6000, "LITER")).toBe(240);
  expect(estimatedCost(1000, "MILLILITER", 200, "LITER")).toBe(0);
  expect(estimatedCost(250000, "MILLILITER", 200, "LITER")).toBe(50);
  expect(estimatedCost(2000, "EACH", 200, "EACH")).toBe(400);
  expect(estimatedCost(100000, "GRAM", 20000, "KILOGRAM")).toBe(2000);
  expect(estimatedCost(100000, "GRAM", null, "KILOGRAM")).toBeNull();
  expect(estimatedCost(100000, "GRAM", 4000, "LITER")).toBeNull();
  // A fractional gram at a high price demonstrates rounding cost once, after exact scaling.
  expect(
    estimatedRecipeIngredientCost(1, 3, 1, "GRAM", {
      price: 2000000000,
      unit: "GRAM",
    }),
  ).toBe(666667);
});
it("estimates recipes at their standard yield and requested portions using current catalog quotes", async () => {
  const recipe = await db.recipe.findUniqueOrThrow({
    where: { id: "seed-recipe-rice" },
    include: recipeInclude,
  });
  const quote = referenceQuote(recipe.ingredients[0].ingredient)!;
  expect(
    estimatedRecipeIngredientCost(
      recipe.ingredients[0].quantityMilli,
      10,
      10,
      "GRAM",
      quote,
    ),
  ).toBe(450);
  expect(
    estimatedRecipeIngredientCost(
      recipe.ingredients[0].quantityMilli,
      10,
      30,
      "GRAM",
      quote,
    ),
  ).toBe(1350);
  expect(summarizeCosts([450, null])).toEqual({
    pricedCount: 1,
    unknownCount: 1,
    subtotalCentavos: 450,
    totalCentavos: null,
  });
  expect(summarizeCosts([450, 800]).totalCentavos).toBe(1250);
  expect(summarizeCosts([null, null]).subtotalCentavos).toBe(0);
  expect(summarizeCosts([null, null]).totalCentavos).toBeNull();
});
it("prefers saved shopping prices and uses an unsaved catalog fallback only when the item price is blank", () => {
  const ingredient = {
    baseUnit: "GRAM" as const,
    displayUnit: "GRAM",
    referencePriceCentavos: 750,
    referencePriceUnit: "KILOGRAM",
  };
  expect(shoppingQuote(1250, "KILOGRAM", ingredient)).toEqual({
    price: 1250,
    unit: "KILOGRAM",
    source: "list",
  });
  expect(shoppingQuote(0, "GRAM", ingredient)).toEqual({
    price: 0,
    unit: "GRAM",
    source: "list",
  });
  const fallback = shoppingQuote(null, null, ingredient);
  expect(fallback).toEqual({ price: 750, unit: "KILOGRAM", source: "catalog" });
  expect(estimatedCost(1000000, "GRAM", fallback.price, fallback.unit)).toBe(
    750,
  );
  expect(estimatedCost(2000000, "GRAM", fallback.price, fallback.unit)).toBe(
    1500,
  );
  expect(ingredient.referencePriceCentavos).toBe(750);
});
it("fills only unset prices, preserves manual prices including zero, and leaves shopping records unchanged on repeats", async () => {
  const filledIds = [
    "seed-carrots",
    "seed-coconut-milk",
    "seed-lemon",
    "seed-olive-oil",
    "seed-oats",
    "seed-spinach",
    "seed-tomatoes",
    "seed-cocoa",
    "seed-water",
  ];
  const rollback = new Error("rollback price fixtures");
  try {
    await db.$transaction(
      async (tx) => {
        await tx.ingredient.update({
          where: { id: "seed-rice" },
          data: { referencePriceCentavos: 0, referencePriceUnit: "GRAM" },
        });
        await tx.ingredient.update({
          where: { id: "seed-lentils" },
          data: { referencePriceCentavos: 999, referencePriceUnit: "KILOGRAM" },
        });
        await tx.ingredient.updateMany({
          where: { id: { in: filledIds } },
          data: { referencePriceCentavos: null, referencePriceUnit: null },
        });
        const before = {
          ingredients: await tx.ingredient.findMany({ orderBy: { id: "asc" } }),
          recipes: await tx.recipeIngredient.findMany(),
          items: await tx.shoppingItem.findMany({ orderBy: { id: "asc" } }),
          lists: await tx.shoppingList.findMany({ orderBy: { id: "asc" } }),
          plans: await tx.operationMealPlan.findMany({
            orderBy: { id: "asc" },
          }),
        };
        expect(await fillUnsetReferencePrices(tx)).toBe(filledIds.length);
        const rows = await tx.ingredient.findMany({ orderBy: { id: "asc" } });
        expect(
          rows.find((i) => i.id === "seed-rice")!.referencePriceCentavos,
        ).toBe(0);
        expect(
          rows.find((i) => i.id === "seed-lentils")!.referencePriceCentavos,
        ).toBe(999);
        expect(
          rows.find((i) => i.id === "seed-carrots")!.referencePriceCentavos,
        ).toBe(650);
        expect(
          rows.find((i) => i.id === "seed-coconut-milk")!
            .referencePriceCentavos,
        ).toBe(4000);
        for (const row of rows) {
          const old = before.ingredients.find((i) => i.id === row.id)!;
          if (!filledIds.includes(row.id)) expect(row).toEqual(old);
          else {
            const {
              referencePriceCentavos,
              referencePriceUnit,
              updatedAt,
              ...fields
            } = row;
            const {
              referencePriceCentavos: a,
              referencePriceUnit: b,
              updatedAt: c,
              ...original
            } = old;
            expect(fields).toEqual(original);
          }
        }
        expect(await fillUnsetReferencePrices(tx)).toBe(0);
        expect(
          await tx.ingredient.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(rows);
        expect(await tx.recipeIngredient.findMany()).toEqual(before.recipes);
        expect(
          await tx.shoppingItem.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before.items);
        expect(
          await tx.shoppingList.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before.lists);
        expect(
          await tx.operationMealPlan.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before.plans);
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
});
it("lets owners edit price quotes independently of ingredient measurement units", async () => {
  const ingredient = await db.ingredient.create({
    data: {
      name: "Price edit test ingredient",
      normalizedName: "price edit test ingredient",
      baseUnit: "GRAM",
      displayUnit: "GRAM",
    },
  });
  try {
    const form = new FormData();
    Object.entries({
      name: ingredient.name,
      displayUnit: "GRAM",
      referencePrice: "9.25",
      referencePriceUnit: "KILOGRAM",
      notes: "",
    }).forEach(([key, value]) => form.set(key, value));
    await saveIngredient(
      form,
      ingredient.id,
      ingredient.updatedAt.toISOString(),
      db,
    );
    const row = await db.ingredient.findUniqueOrThrow({
      where: { id: ingredient.id },
    });
    expect(row.baseUnit).toBe("GRAM");
    expect(row.displayUnit).toBe("GRAM");
    expect(row.referencePriceCentavos).toBe(925);
    expect(row.referencePriceUnit).toBe("KILOGRAM");
    form.set("referencePriceUnit", "LITER");
    await expect(
      saveIngredient(form, row.id, row.updatedAt.toISOString(), db),
    ).rejects.toThrow("measurement type");
  } finally {
    await db.ingredient.delete({ where: { id: ingredient.id } });
  }
});

it("prices a complete multi-ingredient recipe and shopping estimate with mass, volume and count quotes", async () => {
  const recipe = await db.recipe.findUniqueOrThrow({
    where: { id: "seed-recipe-carrot-salad" },
    include: recipeInclude,
  });
  const costs = recipe.ingredients.map((line) =>
    estimatedRecipeIngredientCost(
      line.quantityMilli,
      recipe.standardPortionYield,
      recipe.standardPortionYield,
      line.unit,
      referenceQuote(line.ingredient),
    ),
  );
  // 800 g carrots (5.20), two lemons (4.00), 40 mL oil (2.40).
  expect(summarizeCosts(costs)).toEqual({
    pricedCount: 3,
    unknownCount: 0,
    subtotalCentavos: 1160,
    totalCentavos: 1160,
  });
  for (const line of recipe.ingredients) {
    const quote = referenceQuote(line.ingredient)!;
    const fallback = shoppingQuote(null, null, line.ingredient);
    expect(
      estimatedCost(
        line.quantityMilli,
        line.unit,
        fallback.price,
        fallback.unit,
      ),
    ).toBe(
      estimatedRecipeIngredientCost(
        line.quantityMilli,
        recipe.standardPortionYield,
        recipe.standardPortionYield,
        line.unit,
        quote,
      ),
    );
  }
});
