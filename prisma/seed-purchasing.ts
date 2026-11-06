import type { Prisma } from "@prisma/client";
import { dateForDay, operationDayCount } from "../src/lib/menus/planning";
import { recipeInclude, snapshotRecipe } from "../src/lib/menus/catalog";
import type { PlannedMeal, TemplateMeal } from "../src/lib/menus/types";
import { getPurchasingContext } from "../src/lib/purchasing/context";
import { MAX_QUANTITY } from "../src/lib/purchasing/requirements";
export async function seedPurchasing(db: Prisma.TransactionClient) {
  const retreat = await db.operation.findUnique({
    where: { id: "seed-retreat-session-3" },
    include: { mealPlan: true },
  });
  if (retreat?.type === "RETREAT" && !retreat.mealPlan) {
    const template = await db.menuTemplate.findUnique({
        where: { id: "seed-menu-retreat" },
      }),
      recipes = await db.recipe.findMany({
        where: { archivedAt: null },
        include: recipeInclude,
      });
    if (template) {
      const meals = (
        JSON.parse(template.scheduleJson) as TemplateMeal[]
      ).filter((m) => m.day <= operationDayCount(retreat));
      if (
        meals.length &&
        meals.every((m) =>
          m.dishes.every((d) => recipes.some((r) => r.id === d.recipeId)),
        )
      ) {
        const planned: PlannedMeal[] = meals.map((m) => ({
          key: `seed-shopping-${m.key}`,
          date: dateForDay(retreat.startDate, m.day),
          type: m.type,
          notes: m.notes,
          dishes: m.dishes.map((d, index) => ({
            key: `seed-shopping-${m.key}-${index}`,
            recipeId: d.recipeId,
            portions: 30,
            snapshot: snapshotRecipe(recipes.find((r) => r.id === d.recipeId)!),
          })),
        }));
        await db.operationMealPlan.upsert({
          where: { operationId: retreat.id },
          update: {},
          create: {
            id: "seed-plan-retreat-shopping",
            operationId: retreat.id,
            sourceTemplateName: template.name,
            scheduleJson: JSON.stringify(planned),
          },
        });
      }
    }
  }
  for (const [ingredientId, quantity] of [
    ["seed-rice", 3000000n],
    ["seed-carrots", 500000n],
  ] as const)
    await db.availableStock.upsert({
      where: { scopeKey_ingredientId: { scopeKey: "BUSINESS", ingredientId } },
      update: {},
      create: {
        id: `seed-business-stock-${ingredientId}`,
        ingredientId,
        ownership: "BUSINESS",
        scopeKey: "BUSINESS",
        quantityMilli: quantity,
        unit: "GRAM",
        notes: "Check the dry goods and produce shelves before shopping.",
      },
    });
  const planned = await db.operationMealPlan.findUnique({
    where: { operationId: "seed-retreat-session-3" },
  });
  if (
    retreat?.type === "RETREAT" &&
    planned?.id === "seed-plan-retreat-shopping"
  ) {
    await db.availableStock.upsert({
      where: {
        scopeKey_ingredientId: {
          scopeKey: retreat.id,
          ingredientId: "seed-rice",
        },
      },
      update: {},
      create: {
        id: "seed-school-stock-rice",
        ingredientId: "seed-rice",
        ownership: "SCHOOL",
        scopeKey: retreat.id,
        operationId: retreat.id,
        quantityMilli: 1000000n,
        unit: "GRAM",
        notes: "School-owned rice set aside for this retreat.",
      },
    });
    const meals = JSON.parse(planned.scheduleJson) as PlannedMeal[];
    if (
      meals.some((m) =>
        m.dishes.some((d) =>
          d.snapshot.ingredients.some((i) => i.ingredientId === "seed-carrots"),
        ),
      )
    )
      await db.ingredientSubstitution.upsert({
        where: {
          operationId_originalIngredientId: {
            operationId: retreat.id,
            originalIngredientId: "seed-carrots",
          },
        },
        update: {},
        create: {
          id: "seed-retreat-carrot-replacement",
          operationId: retreat.id,
          originalIngredientId: "seed-carrots",
          replacementIngredientId: "seed-pumpkin",
          quantityMilli: 4500000n,
          unit: "GRAM",
          notes:
            "Use this total replacement amount for the operation and confirm organic sourcing.",
        },
      });
  }
  for (const operationId of [
    "seed-retreat-session-3",
    "seed-operation-2",
    "seed-operation-5",
  ]) {
    const context = await getPurchasingContext(operationId, db);
    if (
      !context?.operation.mealPlan ||
      context.operation.shoppingList ||
      context.issues.length ||
      !context.requirements.length
    )
      continue;
    // All adjustments belong to create data only. Empty update preserves every existing
    // shopping item, including manual quantities, notes, purchased state and exclusions.
    await db.shoppingList.upsert({
      where: { operationId },
      update: {},
      create: {
        operationId,
        ownership: context.policy.inventoryOwner,
        organicRequired: context.policy.organicRequired,
        sourceFingerprint: context.fingerprint,
        items: {
          create: context.requirements.map((r, index) => ({
            ingredientId: r.ingredientId,
            ingredientName: r.name,
            unit: r.unit,
            requiredMilli: BigInt(r.requiredMilli),
            availableMilli:
              r.availableMilli == null ? null : BigInt(r.availableMilli),
            plannedMilli: BigInt(
              index === 0
                ? Math.min(MAX_QUANTITY, r.suggestedMilli + 500000)
                : r.suggestedMilli,
            ),
            estimatedPriceCentavos: r.priceCentavos,
            priceUnit: r.priceUnit,
            notes:
              index === 0
                ? context.policy.organicRequired
                  ? "Allow for supplier pack sizes and confirm organic availability."
                  : "Confirm supplier pack sizes before finalizing the purchase."
                : null,
          })),
        },
      },
    });
  }
}
