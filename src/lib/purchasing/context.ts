import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { db } from "../db";
import { sourcingPolicy } from "../domain";
import type { PlannedMeal } from "../menus/types";
import { calculateRequirements } from "./requirements";
export type PurchasingReader = Pick<
  PrismaClient,
  "operation" | "ingredient" | "availableStock" | "ingredientSubstitution"
>;
export async function getPurchasingContext(
  operationId: string,
  client: PurchasingReader = db,
) {
  const operation = await client.operation.findUnique({
    where: { id: operationId },
    include: {
      mealPlan: true,
      shoppingList: {
        include: { items: { orderBy: { ingredientName: "asc" } } },
      },
    },
  });
  if (!operation) return null;
  const policy = sourcingPolicy(operation.type),
    scopeKey = policy.inventoryOwner === "BUSINESS" ? "BUSINESS" : operation.id;
  const [catalog, substitutions, stock] = await Promise.all([
    client.ingredient.findMany({ orderBy: { name: "asc" } }),
    client.ingredientSubstitution.findMany({
      where: { operationId },
      include: { originalIngredient: true, replacementIngredient: true },
      orderBy: { originalIngredientId: "asc" },
    }),
    client.availableStock.findMany({
      where: {
        scopeKey,
        ownership: policy.inventoryOwner,
        operationId: policy.inventoryOwner === "SCHOOL" ? operation.id : null,
      },
      orderBy: { ingredientId: "asc" },
    }),
  ]);
  const meals: PlannedMeal[] = operation.mealPlan
    ? JSON.parse(operation.mealPlan.scheduleJson)
    : [];
  const result = calculateRequirements(meals, catalog, substitutions);
  const ids = new Set(result.requirements.map((r) => r.ingredientId));
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        type: operation.type,
        plan: operation.mealPlan?.scheduleJson ?? null,
        substitutions: substitutions.map((s) => ({
          originalIngredientId: s.originalIngredientId,
          replacementIngredientId: s.replacementIngredientId,
          quantityMilli: s.quantityMilli.toString(),
          unit: s.unit,
          notes: s.notes,
        })),
        catalog: catalog
          .filter((i) => ids.has(i.id))
          .map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.baseUnit,
            price: i.referencePriceCentavos,
            priceUnit: i.referencePriceUnit ?? i.displayUnit,
          })),
        stock: stock
          .filter((s) => ids.has(s.ingredientId))
          .map((s) => ({
            id: s.ingredientId,
            quantity: s.quantityMilli.toString(),
            unit: s.unit,
          })),
      }),
    )
    .digest("hex");
  const requirements = result.requirements.map((r) => {
    const available = stock.find(
      (s) => s.ingredientId === r.ingredientId && s.unit === r.unit,
    );
    const availableMilli = available ? Number(available.quantityMilli) : null;
    return {
      ...r,
      availableMilli,
      suggestedMilli: Math.max(0, r.requiredMilli - (availableMilli ?? 0)),
    };
  });
  return {
    operation,
    policy,
    scopeKey,
    catalog,
    substitutions,
    stock,
    meals,
    ...result,
    requirements,
    fingerprint,
    stale:
      !!operation.shoppingList &&
      operation.shoppingList.sourceFingerprint !== fingerprint,
  };
}
export type PurchasingContext = NonNullable<
  Awaited<ReturnType<typeof getPurchasingContext>>
>;
