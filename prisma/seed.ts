import "dotenv/config";
import { PrismaClient, OperationType } from "@prisma/client";
import { fillUnsetReferencePrices } from "./reference-prices";
import { seedPurchasing } from "./seed-purchasing";
import { seedMenus } from "./seed-menus";
import { validateOperation } from "../src/lib/domain";
const db = new PrismaClient();
async function main() {
  // Insert missing examples only. Preserve attendance, dates, notes, and other owner edits on reruns.
  await db.$transaction(async (tx) => {
    const school = await tx.location.upsert({
      where: { id: "seed-school" },
      update: {},
      create: {
        id: "seed-school",
        name: "Green Valley Learning Center",
        description: "Retreat school",
      },
    });
    const city = await tx.location.upsert({
      where: { id: "seed-city" },
      update: {},
      create: {
        id: "seed-city",
        name: "Garden Studio Kitchen",
        description: "Rented city kitchen",
      },
    });
    const event = await tx.location.upsert({
      where: { id: "seed-event" },
      update: {},
      create: {
        id: "seed-event",
        name: "Sunflower Community Hall",
        description: "Event venue",
      },
    });
    const examples: [
      string,
      OperationType,
      number,
      number,
      string,
      number,
      number?,
    ][] = [
      ["Weekend renewal retreat", "RETREAT", 3, 5, school.id, 32, 26],
      ["Mindful living retreat", "RETREAT", 17, 19, school.id, 40, 34],
      ["Tuesday lunch service", "CITY_SERVICE", 1, 1, city.id, 24],
      ["Thursday takeaway service", "CITY_SERVICE", 8, 8, city.id, 30],
      ["Community lunch service", "CITY_SERVICE", 10, 10, city.id, 28],
      ["Seasonal celebration", "PRIVATE_EVENT", 12, 12, event.id, 45],
      ["Garden gathering", "PRIVATE_EVENT", 24, 24, event.id, 20],
    ];
    const anchor = new Date();
    anchor.setUTCHours(15, 0, 0, 0);
    for (const [
      index,
      [
        name,
        type,
        start,
        end,
        locationId,
        expectedDiners,
        billableParticipants,
      ],
    ] of examples.entries()) {
      const data = {
        name,
        type,
        startDate: new Date(anchor.getTime() + start * 86400000),
        endDate: new Date(anchor.getTime() + end * 86400000),
        locationId,
        expectedDiners,
        billableParticipants: billableParticipants ?? null,
        status: index === 1 ? ("DRAFT" as const) : ("CONFIRMED" as const),
        staffDiscountPercent: type === "RETREAT" ? 60 : null,
      };
      validateOperation(data);
      await tx.operation.upsert({
        where: { id: `seed-operation-${index}` },
        update: {},
        create: { id: `seed-operation-${index}`, ...data },
      });
    }
    // Extra retreat dates can be planned before attendance is confirmed.
    for (let session = 3; session <= 6; session++) {
      const startDate = new Date(
        anchor.getTime() + (3 + (session - 1) * 14) * 86400000,
      );
      await tx.operation.upsert({
        where: { id: `seed-retreat-session-${session}` },
        update: {},
        create: {
          id: `seed-retreat-session-${session}`,
          name: `School retreat - Session ${session}`,
          type: "RETREAT",
          status: "DRAFT",
          locationId: school.id,
          startDate,
          endDate: new Date(startDate.getTime() + 2 * 86400000),
          staffDiscountPercent: 60,
          notes:
            "Confirm diner and staff counts before finalizing preparation quantities.",
        },
      });
    }
    for (const [id, name] of [
      ["rice", "Brown rice"],
      ["lentils", "Green lentils"],
      ["carrots", "Carrots"],
      ["chickpeas", "Chickpeas"],
      ["pumpkin", "Pumpkin"],
    ]) {
      await tx.ingredient.upsert({
        where: { id: `seed-${id}` },
        update: {},
        create: {
          id: `seed-${id}`,
          name,
          normalizedName: name.toLowerCase(),
          baseUnit: "GRAM",
          displayUnit: "GRAM",
        },
      });
    }
    const descriptions: Record<string, string> = {
      rice: "Brown rice steamed until tender.",
      lentils: "A hearty stew of green lentils and carrots.",
      pumpkin: "Roasted pumpkin served with chickpeas.",
    };
    for (const [id, name, ingredient, quantity] of [
      ["rice", "Steamed brown rice", "rice", 600],
      ["lentils", "Carrot and lentil stew", "lentils", 500],
      ["pumpkin", "Roasted pumpkin and chickpeas", "pumpkin", 1200],
    ] as const) {
      const recipeId = `seed-recipe-${id}`;
      await tx.recipe.upsert({
        where: { id: recipeId },
        update: {},
        create: {
          id: recipeId,
          name,
          standardPortionYield: 10,
          description: descriptions[id],
          instructions:
            "Wash ingredients. Cook until tender and season to taste.",
        },
      });
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
          unit: "GRAM",
        },
      });
    }
    for (const [recipe, ingredient, quantity] of [
      ["lentils", "carrots", 400],
      ["pumpkin", "chickpeas", 600],
    ] as const) {
      const recipeId = `seed-recipe-${recipe}`;
      const ingredientId = `seed-${ingredient}`;
      await tx.recipeIngredient.upsert({
        where: { recipeId_ingredientId: { recipeId, ingredientId } },
        update: {},
        create: {
          recipeId,
          ingredientId,
          quantityMilli: quantity * 1000,
          unit: "GRAM",
        },
      });
    }
  });
  await seedMenus(db);
  await db.$transaction((tx) => fillUnsetReferencePrices(tx));
  await seedPurchasing(db);
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
