import { readFileSync } from "node:fs";
import { afterAll, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { PlannedMeal } from "../src/lib/menus/types";
if (!process.env.DATABASE_URL?.endsWith("/prisma/test.db"))
  throw new Error("Run npm test with the isolated database.");
const db = new PrismaClient();
afterAll(() => db.$disconnect());
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20261106030000_clean_user_facing_copy/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
// This fixed data migration terminates each statement on its own line. Semicolons
// inside legacy note strings are not statement delimiters.
const statements = migration
  .split(/;\s*(?:\r?\n|$)/)
  .filter((sql) => sql.trim());
it("cleans exact legacy seed copy and snapshots without changing owner edits or business data, and is idempotent", async () => {
  const rollback = new Error("rollback cleanup fixtures");
  try {
    await db.$transaction(
      async (tx) => {
        await tx.recipe.updateMany({
          where: { id: { in: ["seed-recipe-rice", "seed-recipe-pumpkin"] } },
          data: { description: "Fictional vegan recipe for development." },
        });
        await tx.recipe.update({
          where: { id: "seed-recipe-porridge" },
          data: { description: "Fictional vegan development recipe." },
        });
        await tx.recipe.update({
          where: { id: "seed-recipe-lentils" },
          data: {
            description:
              "Owner recipe description: use the sample batch instructions.",
          },
        });
        await tx.recipe.create({
          data: {
            id: "cleanup-owner-recipe",
            name: "Owner recipe",
            description: "Fictional vegan recipe for development.",
            standardPortionYield: 10,
            instructions: "Keep these preparation instructions.",
          },
        });
        await tx.location.update({
          where: { id: "seed-school" },
          data: { description: "Fictional retreat school" },
        });
        await tx.operation.update({
          where: { id: "seed-operation-0" },
          data: { notes: "Fictional development example. All food is vegan." },
        });
        await tx.operation.update({
          where: { id: "seed-operation-1" },
          data: { notes: "Owner note: keep this sample serving arrangement." },
        });
        await tx.operation.update({
          where: { id: "seed-retreat-session-3" },
          data: {
            notes:
              "Fictional retreat at the same school. Attendance is unconfirmed; update guest, staff, and buffer counts when available.",
          },
        });
        await tx.menuTemplate.update({
          where: { id: "seed-menu-retreat" },
          data: { description: "Fictional reusable vegan menu." },
        });
        await tx.menuTemplate.update({
          where: { id: "seed-menu-city" },
          data: { description: "Owner menu description." },
        });
        const plan = await tx.operationMealPlan.findUniqueOrThrow({
          where: { operationId: "seed-operation-5" },
        });
        const meals: PlannedMeal[] = JSON.parse(plan.scheduleJson);
        meals[0].notes = "Custom fictional celebration menu.";
        const originalDish = meals[0].dishes.find(
          (d) => d.recipeId === "seed-recipe-pumpkin",
        )!;
        originalDish.snapshot.description =
          "Fictional vegan recipe for development.";
        const ownerDish = structuredClone(originalDish);
        ownerDish.key = "cleanup-owner-dish";
        ownerDish.recipeId = "cleanup-owner-recipe";
        ownerDish.snapshot.recipeId = "cleanup-owner-recipe";
        ownerDish.snapshot.name = "Owner recipe";
        meals[0].dishes.push(ownerDish);
        const otherDish = meals[0].dishes.find(
          (d) => d.recipeId === "seed-recipe-carrot-salad",
        )!;
        otherDish.snapshot.description = "Owner snapshot description.";
        await tx.operationMealPlan.update({
          where: { id: plan.id },
          data: {
            notes: "Fictional example; quantities can be customized per dish.",
            scheduleJson: JSON.stringify(meals),
          },
        });
        const before = {
          operations: await tx.operation.findMany({ orderBy: { id: "asc" } }),
          recipes: await tx.recipe.findMany({ orderBy: { id: "asc" } }),
          links: await tx.recipeIngredient.findMany(),
          templates: await tx.menuTemplate.findMany({ orderBy: { id: "asc" } }),
          plans: await tx.operationMealPlan.findMany({
            orderBy: { id: "asc" },
          }),
        };
        for (const sql of statements) await tx.$executeRawUnsafe(sql);
        const after = {
          operations: await tx.operation.findMany({ orderBy: { id: "asc" } }),
          recipes: await tx.recipe.findMany({ orderBy: { id: "asc" } }),
          links: await tx.recipeIngredient.findMany(),
          templates: await tx.menuTemplate.findMany({ orderBy: { id: "asc" } }),
          plans: await tx.operationMealPlan.findMany({
            orderBy: { id: "asc" },
          }),
        };
        expect(after.operations.map(({ notes, ...rest }) => rest)).toEqual(
          before.operations.map(({ notes, ...rest }) => rest),
        );
        expect(after.recipes.map(({ description, ...rest }) => rest)).toEqual(
          before.recipes.map(({ description, ...rest }) => rest),
        );
        expect(after.templates.map(({ description, ...rest }) => rest)).toEqual(
          before.templates.map(({ description, ...rest }) => rest),
        );
        expect(after.links).toEqual(before.links);
        expect(
          after.operations.find((o) => o.id === "seed-operation-0")!.notes,
        ).toBeNull();
        expect(
          after.operations.find((o) => o.id === "seed-operation-1")!.notes,
        ).toBe("Owner note: keep this sample serving arrangement.");
        expect(
          after.recipes.find((r) => r.id === "seed-recipe-rice")!.description,
        ).toBe("Brown rice steamed until tender.");
        expect(
          after.recipes.find((r) => r.id === "seed-recipe-lentils")!
            .description,
        ).toBe("Owner recipe description: use the sample batch instructions.");
        expect(
          after.recipes.find((r) => r.id === "cleanup-owner-recipe")!
            .description,
        ).toBe("Fictional vegan recipe for development.");
        expect(
          after.templates.find((t) => t.id === "seed-menu-city")!.description,
        ).toBe("Owner menu description.");
        const expected = structuredClone(meals);
        expected[0].notes = "";
        expected[0].dishes.find(
          (d) => d.recipeId === "seed-recipe-pumpkin",
        )!.snapshot.description = "Roasted pumpkin served with chickpeas.";
        const cleaned = after.plans.find((p) => p.id === plan.id)!;
        expect(JSON.parse(cleaned.scheduleJson)).toEqual(expected);
        expect(cleaned.notes).toBeNull();
        expect(cleaned.updatedAt).toEqual(
          before.plans.find((p) => p.id === plan.id)!.updatedAt,
        );
        for (const sql of statements) await tx.$executeRawUnsafe(sql);
        expect(
          await tx.operationMealPlan.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(after.plans);
        expect(await tx.recipe.findMany({ orderBy: { id: "asc" } })).toEqual(
          after.recipes,
        );
        throw rollback;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
});
it("new seed content uses useful descriptions and clean saved-plan copy", async () => {
  const recipes = await db.recipe.findMany({
    where: { id: { startsWith: "seed-recipe-" } },
  });
  const templates = await db.menuTemplate.findMany();
  const plans = await db.operationMealPlan.findMany();
  const operations = await db.operation.findMany();
  const locations = await db.location.findMany();
  const copy = [
    ...recipes.map((r) => r.description),
    ...templates.map((t) => t.description),
    ...plans.map((p) => p.notes),
    ...operations.map((o) => o.notes),
    ...locations.map((l) => l.description),
  ]
    .filter(Boolean)
    .join("\n");
  expect(copy).not.toMatch(/fictional|sample|demo|development|foundation/i);
  for (const plan of plans) {
    const meals: PlannedMeal[] = JSON.parse(plan.scheduleJson);
    for (const meal of meals) {
      expect(meal.notes).not.toMatch(/fictional|sample|demo|development/i);
      for (const dish of meal.dishes)
        expect(dish.snapshot.description ?? "").not.toMatch(
          /fictional|sample|demo|development/i,
        );
    }
  }
});
