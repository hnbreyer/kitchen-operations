import type { PrismaClient, MeasurementUnit } from "@prisma/client";
import { recipeInclude, snapshotRecipe } from "../src/lib/menus/catalog";
import { dateKey } from "../src/lib/calendar";
import type { TemplateMeal, PlannedMeal } from "../src/lib/menus/types";
export async function seedMenus(db: PrismaClient) {
  await db.$transaction(async (tx) => {
    const ingredients: [string, string, MeasurementUnit][] = [
      ["oats", "Rolled oats", "GRAM"],
      ["banana", "Bananas", "GRAM"],
      ["coconut-milk", "Unsweetened coconut milk", "MILLILITER"],
      ["tomatoes", "Tomatoes", "GRAM"],
      ["spinach", "Spinach", "GRAM"],
      ["olive-oil", "Olive oil", "MILLILITER"],
      ["lemon", "Lemons", "EACH"],
      ["cocoa", "Unsweetened cocoa", "GRAM"],
      ["oranges", "Oranges", "GRAM"],
      ["water", "Water", "MILLILITER"],
    ];
    for (const [slug, name, baseUnit] of ingredients)
      await tx.ingredient.upsert({
        where: { id: `seed-${slug}` },
        update: {},
        create: {
          id: `seed-${slug}`,
          name,
          normalizedName: name.toLowerCase(),
          baseUnit,
          displayUnit: baseUnit,
        },
      });
    const recipes: {
      slug: string;
      name: string;
      category: string;
      description: string;
      instructions: string;
      minutes: number;
      ingredients: [string, number, MeasurementUnit][];
    }[] = [
      {
        slug: "porridge",
        description: "Creamy oats with banana and coconut milk.",
        name: "Banana and coconut oat porridge",
        category: "BREAKFAST",
        minutes: 25,
        instructions:
          "Simmer oats with coconut milk and water as needed. Fold in sliced bananas and serve warm.",
        ingredients: [
          ["oats", 800, "GRAM"],
          ["banana", 1200, "GRAM"],
          ["coconut-milk", 2000, "MILLILITER"],
        ],
      },
      {
        slug: "chickpea-tomato",
        description: "Chickpeas simmered with tomatoes and spinach.",
        name: "Chickpea, tomato and spinach stew",
        category: "MAIN",
        minutes: 45,
        instructions:
          "Cook soaked chickpeas until tender. Sauté tomatoes in olive oil, add chickpeas, and fold in spinach until wilted.",
        ingredients: [
          ["chickpeas", 800, "GRAM"],
          ["tomatoes", 1000, "GRAM"],
          ["spinach", 500, "GRAM"],
          ["olive-oil", 50, "MILLILITER"],
        ],
      },
      {
        slug: "carrot-salad",
        description: "Grated carrots dressed with lemon and olive oil.",
        name: "Carrot and lemon salad",
        category: "SIDE",
        minutes: 20,
        instructions:
          "Grate washed carrots. Squeeze lemons and toss their juice with olive oil and carrots.",
        ingredients: [
          ["carrots", 800, "GRAM"],
          ["lemon", 2, "EACH"],
          ["olive-oil", 40, "MILLILITER"],
        ],
      },
      {
        slug: "cocoa-pudding",
        description: "A chilled banana, cocoa, and coconut milk pudding.",
        name: "Banana cocoa pudding",
        category: "DESSERT",
        minutes: 15,
        instructions:
          "Blend ripe bananas, unsweetened cocoa, and coconut milk until smooth. Chill before serving.",
        ingredients: [
          ["banana", 1200, "GRAM"],
          ["cocoa", 100, "GRAM"],
          ["coconut-milk", 500, "MILLILITER"],
        ],
      },
      {
        slug: "orange-drink",
        description: "Fresh orange juice mixed with water.",
        name: "Fresh orange drink",
        category: "BEVERAGE",
        minutes: 15,
        instructions:
          "Juice the oranges. Mix with chilled drinking water and serve immediately.",
        ingredients: [
          ["oranges", 1800, "GRAM"],
          ["water", 1000, "MILLILITER"],
        ],
      },
    ];
    for (const r of recipes) {
      const recipeId = `seed-recipe-${r.slug}`;
      await tx.recipe.upsert({
        where: { id: recipeId },
        update: {},
        create: {
          id: recipeId,
          name: r.name,
          category: r.category,
          standardPortionYield: 10,
          preparationMinutes: r.minutes,
          description: r.description,
          instructions: r.instructions,
        },
      });
      for (const [ingredient, quantity, unit] of r.ingredients)
        await tx.recipeIngredient.upsert({
          where: {
            recipeId_ingredientId: {
              recipeId,
              ingredientId: `seed-${ingredient}`,
            },
          },
          update: {},
          create: {
            recipeId,
            ingredientId: `seed-${ingredient}`,
            quantityMilli: quantity * 1000,
            unit,
          },
        });
    }
    const meal = (
      day: number,
      type: TemplateMeal["type"],
      slugs: string[],
    ): TemplateMeal => ({
      key: `seed-${day}-${type}`,
      day,
      type,
      notes: "",
      dishes: slugs.map((slug) => ({ recipeId: `seed-recipe-${slug}` })),
    });
    const retreat: TemplateMeal[] = [
      meal(1, "BREAKFAST", ["porridge", "orange-drink"]),
      meal(1, "LUNCH", ["rice", "lentils", "carrot-salad"]),
      meal(1, "DINNER", ["pumpkin", "chickpea-tomato"]),
      meal(2, "BREAKFAST", ["porridge"]),
      meal(2, "LUNCH", ["rice", "chickpea-tomato"]),
      meal(2, "DINNER", ["lentils", "carrot-salad", "cocoa-pudding"]),
      meal(3, "BREAKFAST", ["porridge", "orange-drink"]),
      meal(3, "LUNCH", ["rice", "pumpkin", "carrot-salad"]),
    ];
    const city = [
      meal(1, "LUNCH", ["rice", "chickpea-tomato", "carrot-salad"]),
    ];
    const event = [
      meal(1, "DINNER", ["pumpkin", "carrot-salad", "cocoa-pudding"]),
    ];
    const descriptions: Record<string, string> = {
      "seed-menu-retreat":
        "A three-day schedule of breakfasts, lunches, and dinners.",
      "seed-menu-city":
        "A lunch of brown rice, chickpea stew, and carrot salad.",
      "seed-menu-event":
        "A dinner of roasted pumpkin, carrot salad, and banana cocoa pudding.",
    };
    for (const [id, name, schedule] of [
      ["seed-menu-retreat", "Three-day school retreat", retreat],
      ["seed-menu-city", "City lunch menu", city],
      ["seed-menu-event", "Private celebration menu", event],
    ] as const)
      await tx.menuTemplate.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name,
          description: descriptions[id],
          scheduleJson: JSON.stringify(schedule),
        },
      });
    const loaded = await tx.recipe.findMany({ include: recipeInclude });
    for (const [operationId, schedule, isCustom] of [
      ["seed-operation-2", city, false],
      ["seed-operation-5", event, true],
    ] as const) {
      const operation = await tx.operation.findUnique({
        where: { id: operationId },
      });
      if (!operation) continue;
      const meals: PlannedMeal[] = schedule.map((m) => ({
        key: `seed-${operationId}-${m.key}`,
        date: dateKey(operation.startDate),
        type: m.type,
        notes: "",
        dishes: m.dishes.map((d, i) => ({
          key: `seed-${operationId}-${m.key}-${i}`,
          recipeId: d.recipeId,
          portions: isCustom ? 45 : 24,
          snapshot: snapshotRecipe(loaded.find((r) => r.id === d.recipeId)!),
        })),
      }));
      await tx.operationMealPlan.upsert({
        where: { operationId },
        update: {},
        create: {
          id: `seed-plan-${operationId}`,
          operationId,
          sourceTemplateName: isCustom ? null : "City lunch menu",
          scheduleJson: JSON.stringify(meals),
        },
      });
    }
  });
}
